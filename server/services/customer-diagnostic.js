// Customer-support diagnostic + manual override for the paid_users table.
//
// Built after De'Yona Moore got stuck in a paywall loop despite having paid.
// The check route (/api/provision-access/check) only returns hasAccess:true
// when there's an EXACT lowercase email match in paid_users with
// paid_status='active'. Anything else — missing row (webhook 500 window
// May 21–25), email casing or mailbox typo, status churn — sends the
// customer back to the funnel to pay again.

function normalize(email) {
  return String(email || '').toLowerCase().trim();
}

export function diagnoseCustomer(db, rawEmail) {
  const email = normalize(rawEmail);
  if (!email) return { found: false, error: 'empty email', similar: [] };

  const paidUser = db
    .prepare(`SELECT * FROM paid_users WHERE email = ?`)
    .get(email);

  if (paidUser) {
    return {
      found: true,
      email,
      paid_user: paidUser,
      similar: [],
    };
  }

  // Surface close-matches so the operator can spot common mistakes:
  //   - they paid as deyona@gmail.com, signing in as deyona@yahoo.com
  //   - they paid as 'foo+stripe@gmail.com', signing in as 'foo@gmail.com'
  //   - a missing dot or doubled character
  // We match on the local-part (before @) plus any row sharing the same
  // domain — close-enough for a human to recognize the right one.
  const local = email.split('@')[0] || '';
  const domain = email.split('@')[1] || '';

  const similar = [];
  if (local.length >= 3) {
    const rows = db
      .prepare(`SELECT * FROM paid_users WHERE LOWER(email) LIKE ?`)
      .all(`%${local.slice(0, Math.max(3, Math.floor(local.length * 0.6)))}%`);
    similar.push(...rows);
  }
  if (domain) {
    const rows = db
      .prepare(`SELECT * FROM paid_users WHERE LOWER(email) LIKE ?`)
      .all(`%@${domain}`);
    for (const r of rows) {
      if (!similar.some((s) => s.email === r.email)) similar.push(r);
    }
  }

  return {
    found: false,
    email,
    paid_user: null,
    similar: similar.slice(0, 10),
  };
}

export function grantAccess(db, { email, name } = {}) {
  const normalized = normalize(email);
  if (!normalized) return { action: 'error', error: 'missing email' };

  // Try insert first. If the email already exists, fall through to update.
  try {
    db.prepare(
      `INSERT INTO paid_users (email, name, paid_status) VALUES (?, ?, 'active')`,
    ).run(normalized, name || null);
    return { action: 'created', email: normalized };
  } catch (err) {
    const msg = String(err.message || '');
    if (!/UNIQUE|unique/i.test(msg)) {
      return { action: 'error', error: msg };
    }
    db.prepare(`UPDATE paid_users SET paid_status = 'active', updated_at = datetime('now') WHERE email = ?`)
      .run(normalized);
    return { action: 'reactivated', email: normalized };
  }
}
