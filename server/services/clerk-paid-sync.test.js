import test from 'node:test';
import assert from 'node:assert/strict';
import { syncClerkPaidUsers, extractPrimaryEmail, extractFullName } from './clerk-paid-sync.js';

function makeDb(initial = []) {
  const rows = initial.map((r) => ({ ...r }));
  return {
    rows,
    prepare(sql) {
      if (/INSERT INTO paid_users/i.test(sql)) {
        return {
          run: (email, name) => {
            if (rows.some((r) => r.email === email)) {
              throw new Error('UNIQUE constraint failed: paid_users.email');
            }
            rows.push({ email, name, paid_status: 'active', welcome_email_sent_at: null });
          },
        };
      }
      if (/UPDATE paid_users SET paid_status/i.test(sql)) {
        return {
          run: (email) => {
            const r = rows.find((x) => x.email === email);
            if (r) r.paid_status = 'active';
          },
        };
      }
      if (/SELECT welcome_email_sent_at/i.test(sql)) {
        return {
          get: (email) => rows.find((r) => r.email === email) || null,
        };
      }
      if (/UPDATE paid_users SET welcome_email_sent_at/i.test(sql)) {
        return {
          run: (email) => {
            const r = rows.find((x) => x.email === email);
            if (r) r.welcome_email_sent_at = '2026-06-01 12:00:00';
          },
        };
      }
      throw new Error(`unexpected SQL in test: ${sql}`);
    },
  };
}

// A Clerk Backend API user shape — taken from De'Yona's actual record so
// the test exercises the real production payload.
function deyonaShape() {
  return {
    id: 'user_3EQFGl4xLtWdFx3p0UteB5sJDIH',
    first_name: "De'Yona",
    last_name: 'Moore',
    primary_email_address_id: 'idn_3EQFGn0ATdKuC99ixliOGyz1nXJ',
    email_addresses: [
      {
        id: 'idn_3EQFGn0ATdKuC99ixliOGyz1nXJ',
        email_address: 'deyonamoore@gmail.com',
      },
    ],
    public_metadata: {
      plan: 'alignment_engine',
      purchased_at: '2026-05-30T00:59:52.019Z',
    },
  };
}

test('extractPrimaryEmail picks the primary email by id, falling back to the first one', () => {
  const u = deyonaShape();
  assert.equal(extractPrimaryEmail(u), 'deyonamoore@gmail.com');

  // Missing primary_email_address_id → fallback to first
  const u2 = { ...u, primary_email_address_id: null };
  assert.equal(extractPrimaryEmail(u2), 'deyonamoore@gmail.com');

  // No emails at all → null
  assert.equal(extractPrimaryEmail({ ...u, email_addresses: [] }), null);
  assert.equal(extractPrimaryEmail({}), null);
});

test('extractFullName joins first_name + last_name; trims; returns null when blank', () => {
  assert.equal(extractFullName(deyonaShape()), "De'Yona Moore");
  assert.equal(extractFullName({ first_name: 'Only' }), 'Only');
  assert.equal(extractFullName({ last_name: 'Only' }), 'Only');
  assert.equal(extractFullName({}), null);
  assert.equal(extractFullName({ first_name: '   ', last_name: '' }), null);
});

test('syncClerkPaidUsers backfills paid_users for every Clerk user whose metadata says paid', async () => {
  const db = makeDb([]);
  const clerkUsers = [
    deyonaShape(),
    { id: 'user_FREE', first_name: 'Free', email_addresses: [{ email_address: 'free@example.com' }], public_metadata: {} },
    { id: 'user_UNPAID', first_name: 'Unpaid', email_addresses: [{ email_address: 'u@example.com' }], public_metadata: { plan: 'unpaid' } },
    { id: 'user_OTHER', first_name: 'Other', email_addresses: [{ email_address: 'paid2@example.com' }], public_metadata: { plan: 'alignment_engine' } },
  ];
  const sends = [];
  const sendWelcome = async ({ email, name }) => {
    sends.push({ email, name });
    return { ok: true, id: `msg-${email}` };
  };
  const listAllUsers = async function* () {
    for (const u of clerkUsers) yield u;
  };

  const summary = await syncClerkPaidUsers({ listAllUsers, db, sendWelcome });

  assert.equal(summary.scanned, 4);
  assert.equal(summary.paid, 2, 'must skip unpaid plans and missing-plan users');
  assert.equal(summary.created, 2);
  assert.equal(summary.reactivated, 0);
  assert.equal(summary.emails_sent, 2);
  assert.deepEqual(
    db.rows.map((r) => r.email).sort(),
    ['deyonamoore@gmail.com', 'paid2@example.com'],
  );
});

test('syncClerkPaidUsers reactivates existing rows instead of duplicating them', async () => {
  const db = makeDb([
    { email: 'deyonamoore@gmail.com', name: "De'Yona", paid_status: 'churned', welcome_email_sent_at: '2026-05-25 10:00:00' },
  ]);
  const listAllUsers = async function* () { yield deyonaShape(); };
  const sendWelcome = async () => ({ ok: true, id: 'x' });

  const summary = await syncClerkPaidUsers({ listAllUsers, db, sendWelcome });

  assert.equal(summary.created, 0);
  assert.equal(summary.reactivated, 1);
  assert.equal(db.rows.length, 1, 'must not duplicate the row');
  assert.equal(db.rows[0].paid_status, 'active', 'must flip back to active');
  assert.equal(summary.emails_sent, 0, 'must not re-send the welcome email when already sent');
});

test('syncClerkPaidUsers skips welcome emails entirely when sendWelcome is omitted', async () => {
  const db = makeDb([]);
  const listAllUsers = async function* () { yield deyonaShape(); };
  const summary = await syncClerkPaidUsers({ listAllUsers, db });
  assert.equal(summary.created, 1);
  assert.equal(summary.emails_sent, 0);
});

test('syncClerkPaidUsers records errors for Clerk users with no email instead of crashing the whole sync', async () => {
  const db = makeDb([]);
  const listAllUsers = async function* () {
    yield { id: 'user_NOEMAIL', public_metadata: { plan: 'alignment_engine' }, email_addresses: [] };
    yield deyonaShape();
  };
  const sendWelcome = async () => ({ ok: true, id: 'x' });

  const summary = await syncClerkPaidUsers({ listAllUsers, db, sendWelcome });
  assert.equal(summary.created, 1, 'second user must still process');
  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0].error, /no email/i);
});
