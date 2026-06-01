// Idempotent opportunity-at-stage upsert for GHL.
//
// The naive pattern (search → if-empty create, else update) is fragile
// because:
//   - GHL's opportunities/search filter can miss opps that exist in the
//     same pipeline (race after upsertContact, brief eventual consistency,
//     or filter-param case mismatch).
//   - When create then fires anyway, GHL rejects with
//       "Can not create duplicate opportunity for the contact."
//   - `ghlFetch` returns null on any non-2xx, so the caller can't tell a
//     real failure from a recoverable duplicate.
//
// This wrapper makes the operation idempotent: if create returns falsy,
// re-find and update the existing opp. Logs cleanly so the Railway logs
// stop showing scary errors for what is actually a benign retry.

const isLikelyArray = (v) => Array.isArray(v);

export async function ensureOpportunityForContact(contactId, opts, deps) {
  const { find, create, update } = deps;
  const updateOpts = {
    stageId: opts.stageId,
    monetaryValue: opts.monetaryValue,
    status: opts.status,
  };

  // 1) Try to find an existing opp and update it.
  const initial = await safeFind(find);
  if (initial.length > 0) {
    await update(initial[0].id, updateOpts);
    return initial[0];
  }

  // 2) None found — try to create.
  const created = await create();
  if (created && created.id) return created;

  // 3) Create came back falsy. The most common cause is GHL rejecting a
  //    duplicate the search missed. Re-find and update — if found, the
  //    "failure" was actually a benign idempotency conflict.
  const recovered = await safeFind(find);
  if (recovered.length > 0) {
    await update(recovered[0].id, updateOpts);
    return recovered[0];
  }

  return null;
}

async function safeFind(find) {
  try {
    const v = await find();
    return isLikelyArray(v) ? v : [];
  } catch {
    return [];
  }
}
