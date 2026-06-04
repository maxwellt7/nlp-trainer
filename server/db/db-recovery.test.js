import test from 'node:test';
import assert from 'node:assert/strict';

import { isFatalDbError, withRecovery } from './db-recovery.js';

test('isFatalDbError matches sticky sql.js failures, ignores ordinary query errors', () => {
  assert.equal(isFatalDbError(new Error('disk I/O error')), true);
  assert.equal(isFatalDbError(new Error('out of memory')), true);
  assert.equal(isFatalDbError(new Error('database disk image is malformed')), true);
  assert.equal(isFatalDbError(new Error('file is not a database')), true);

  assert.equal(isFatalDbError(new Error('no such column: foo')), false);
  assert.equal(isFatalDbError(new Error('UNIQUE constraint failed')), false);
  assert.equal(isFatalDbError(undefined), false);
});

test('withRecovery reloads once and retries when the operation wedges, then succeeds', () => {
  let attempts = 0;
  let reloads = 0;
  const result = withRecovery(
    () => {
      attempts += 1;
      if (attempts === 1) throw new Error('disk I/O error');
      return 'ok';
    },
    { reload: () => { reloads += 1; } },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 2);
  assert.equal(reloads, 1);
});

test('withRecovery does NOT reload on an ordinary query error', () => {
  let reloads = 0;
  assert.throws(
    () => withRecovery(
      () => { throw new Error('no such column: foo'); },
      { reload: () => { reloads += 1; } },
    ),
    /no such column/,
  );
  assert.equal(reloads, 0);
});

test('withRecovery retries at most once — a second fatal error propagates', () => {
  let attempts = 0;
  let reloads = 0;
  assert.throws(
    () => withRecovery(
      () => { attempts += 1; throw new Error('disk I/O error'); },
      { reload: () => { reloads += 1; } },
    ),
    /disk I\/O error/,
  );
  assert.equal(attempts, 2);
  assert.equal(reloads, 1);
});

test('withRecovery is a no-op wrapper when no reload callback is provided', () => {
  assert.throws(
    () => withRecovery(() => { throw new Error('disk I/O error'); }),
    /disk I\/O error/,
  );
});
