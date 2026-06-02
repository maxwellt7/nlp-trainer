import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseCustomer, grantAccess } from './customer-diagnostic.js';

function makeDb(initial) {
  const rows = initial.map((r) => ({ ...r }));
  return {
    rows,
    prepare(sql) {
      if (/SELECT \* FROM paid_users WHERE email/i.test(sql)) {
        return { get: (email) => rows.find((r) => r.email === email) || null };
      }
      if (/SELECT \* FROM paid_users WHERE LOWER\(email\) LIKE/i.test(sql)) {
        return {
          all: (pattern) => {
            const stripped = pattern.replace(/%/g, '');
            return rows.filter((r) => r.email.toLowerCase().includes(stripped.toLowerCase()));
          },
        };
      }
      if (/INSERT INTO paid_users/i.test(sql)) {
        return {
          run: (email, name) => {
            if (rows.some((r) => r.email === email)) {
              throw new Error('UNIQUE constraint failed: paid_users.email');
            }
            rows.push({
              email,
              name: name || null,
              paid_status: 'active',
              clerk_user_id: null,
              welcome_email_sent_at: null,
            });
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
      throw new Error(`unexpected SQL in test: ${sql}`);
    },
  };
}

test('diagnoseCustomer returns the paid_users row when an exact email match exists', () => {
  const db = makeDb([
    { email: 'deyona@example.com', name: "De'Yona", paid_status: 'active', clerk_user_id: 'user_123', welcome_email_sent_at: null },
  ]);
  const result = diagnoseCustomer(db, 'deyona@example.com');
  assert.equal(result.found, true);
  assert.equal(result.paid_user.email, 'deyona@example.com');
  assert.equal(result.paid_user.paid_status, 'active');
});

test('diagnoseCustomer normalizes the email (case + whitespace) before lookup', () => {
  const db = makeDb([
    { email: 'deyona@example.com', name: 'X', paid_status: 'active' },
  ]);
  const result = diagnoseCustomer(db, '  Deyona@Example.com  ');
  assert.equal(result.found, true);
});

test('diagnoseCustomer surfaces close matches when there is no exact hit (typo / different inbox)', () => {
  // Most common cause of the loop: she paid as deyona@gmail.com but is signing
  // in as deyona@yahoo.com. We surface candidates so the operator can spot it.
  const db = makeDb([
    { email: 'deyona@gmail.com', name: 'De\'Yona', paid_status: 'active' },
    { email: 'other@example.com', name: 'Other', paid_status: 'active' },
  ]);
  const result = diagnoseCustomer(db, 'deyona@yahoo.com');
  assert.equal(result.found, false);
  assert.ok(result.similar.some((r) => r.email === 'deyona@gmail.com'),
    'must list the close-match candidate so the operator can spot a typo or mailbox swap');
});

test('grantAccess creates a new paid_users row with paid_status=active when none exists', () => {
  const db = makeDb([]);
  const result = grantAccess(db, { email: 'newcustomer@example.com', name: 'New' });
  assert.equal(result.action, 'created');
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].email, 'newcustomer@example.com');
  assert.equal(db.rows[0].paid_status, 'active');
});

test('grantAccess reactivates an existing row instead of failing on the UNIQUE constraint', () => {
  const db = makeDb([
    { email: 'churned@example.com', name: 'X', paid_status: 'churned' },
  ]);
  const result = grantAccess(db, { email: 'churned@example.com', name: 'X' });
  assert.equal(result.action, 'reactivated');
  assert.equal(db.rows[0].paid_status, 'active');
});
