// Async generator that walks Clerk's /v1/users with limit/offset
// pagination. Extracted from the admin sync route so the safety-cap
// behaviour can be tested in isolation.
//
// Why: the previous in-route generator silently exited when its safety
// counter tripped, so an admin running the sync against a 20,001-user
// workspace would see a "successful" 200 that had quietly skipped the
// last user. Now hitting the cap throws.

const DEFAULT_PAGE_LIMIT = 100;
const DEFAULT_MAX_PAGES = 200;

export async function* paginateClerkUsers({
  apiKey,
  fetchImpl = fetch,
  pageLimit = DEFAULT_PAGE_LIMIT,
  maxPages = DEFAULT_MAX_PAGES,
  baseUrl = 'https://api.clerk.com/v1/users',
} = {}) {
  if (!apiKey) throw new Error('paginateClerkUsers: apiKey is required');

  let offset = 0;
  let pages = 0;
  while (pages < maxPages) {
    pages += 1;
    const url = `${baseUrl}?limit=${pageLimit}&offset=${offset}`;
    const resp = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Clerk users list HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }
    const page = await resp.json();
    if (!Array.isArray(page)) {
      throw new Error(`Clerk users list returned non-array payload (got ${typeof page})`);
    }
    if (page.length === 0) return;
    for (const u of page) yield u;
    if (page.length < pageLimit) return;
    offset += page.length;
  }

  // Walked maxPages full pages without ever getting a short page. The
  // workspace has MORE users than the cap allows. Throw so the admin sees
  // the failure instead of silently writing an incomplete sync.
  throw new Error(
    `paginateClerkUsers: hit max pages (${maxPages}) at offset ${offset}; raise the cap and re-run`,
  );
}
