import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateClerkUsers } from './clerk-users-paginator.js';

function fakeFetch(pages) {
  // pages is a list of arrays (each array becomes one page of the Clerk
  // response). Returns a fetch impl that hands them back in order.
  let i = 0;
  return async () => {
    const body = pages[i] ?? [];
    i += 1;
    return {
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
}

test('paginateClerkUsers yields every user across multiple pages', async () => {
  const fetchImpl = fakeFetch([
    [{ id: 'u1' }, { id: 'u2' }],
    [{ id: 'u3' }],
  ]);
  const collected = [];
  for await (const u of paginateClerkUsers({ apiKey: 'key', fetchImpl, pageLimit: 2 })) {
    collected.push(u.id);
  }
  assert.deepEqual(collected, ['u1', 'u2', 'u3']);
});

test('paginateClerkUsers stops cleanly on an empty page', async () => {
  const fetchImpl = fakeFetch([[{ id: 'u1' }, { id: 'u2' }], []]);
  const collected = [];
  for await (const u of paginateClerkUsers({ apiKey: 'key', fetchImpl, pageLimit: 2 })) {
    collected.push(u.id);
  }
  assert.deepEqual(collected, ['u1', 'u2']);
});

test('paginateClerkUsers throws when Clerk returns a non-array payload', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ data: [{ id: 'u1' }] }), // wrong shape
    text: async () => '',
  });
  await assert.rejects(
    async () => {
      for await (const _ of paginateClerkUsers({ apiKey: 'key', fetchImpl })) { /* drain */ }
    },
    /non-array payload/,
  );
});

test('paginateClerkUsers throws on HTTP failure with the upstream body in the message', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    json: async () => ({}),
    text: async () => 'unauthorized',
  });
  await assert.rejects(
    async () => {
      for await (const _ of paginateClerkUsers({ apiKey: 'bad', fetchImpl })) { /* drain */ }
    },
    /HTTP 401.*unauthorized/,
  );
});

test('paginateClerkUsers throws when the page cap is exhausted on a still-full page (silent-truncation guard)', async () => {
  // Every page comes back fully populated, so the paginator can never know
  // it has reached the end. With maxPages=3 and pageLimit=2 we walk 6
  // users, then must throw rather than quietly return.
  const fetchImpl = fakeFetch([
    [{ id: 'u1' }, { id: 'u2' }],
    [{ id: 'u3' }, { id: 'u4' }],
    [{ id: 'u5' }, { id: 'u6' }],
    [{ id: 'u7' }, { id: 'u8' }], // would be page 4 — never reached
  ]);
  const collected = [];
  await assert.rejects(
    async () => {
      for await (const u of paginateClerkUsers({
        apiKey: 'key',
        fetchImpl,
        pageLimit: 2,
        maxPages: 3,
      })) {
        collected.push(u.id);
      }
    },
    /hit max pages \(3\)/,
  );
  // Important: the partial yields BEFORE the throw still made it out, so
  // callers that snapshot rows-so-far see the truncation.
  assert.deepEqual(collected, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']);
});

test('paginateClerkUsers does NOT throw when the final page is short — that is a normal end-of-list signal', async () => {
  const fetchImpl = fakeFetch([
    [{ id: 'u1' }, { id: 'u2' }],
    [{ id: 'u3' }, { id: 'u4' }],
    [{ id: 'u5' }], // short → end of list
  ]);
  const collected = [];
  for await (const u of paginateClerkUsers({
    apiKey: 'key',
    fetchImpl,
    pageLimit: 2,
    maxPages: 3,
  })) {
    collected.push(u.id);
  }
  assert.deepEqual(collected, ['u1', 'u2', 'u3', 'u4', 'u5']);
});

test('paginateClerkUsers requires an apiKey', async () => {
  await assert.rejects(
    async () => {
      for await (const _ of paginateClerkUsers({ apiKey: '' })) { /* drain */ }
    },
    /apiKey is required/,
  );
});
