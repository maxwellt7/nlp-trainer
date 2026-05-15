// Dropbox → knowledge-base sync.
//
// Runs on a cron interval. Lists all files under DROPBOX_KNOWLEDGE_FOLDER,
// downloads any that have changed since the last successful run, parses the
// content, and feeds it to ingestDocument(). The KB itself dedupes by
// content-hash, so re-running is cheap if nothing has changed.

import { extractTextByExtension } from './pdf-parser.js';
import { ingestDocument, CATEGORY_NLP, CATEGORY_COACHING } from './knowledge-base.js';

const SUPPORTED_EXT = new Set(['pdf', 'txt', 'md', 'markdown']);

// Map Dropbox subfolder names → category labels. Anything not matched gets
// no category (still indexed, just won't be filtered by category-aware
// retrieval).
function categoryFromPath(dropboxPath) {
  const lower = (dropboxPath || '').toLowerCase();
  if (lower.includes('/nlp/') || lower.includes('/nlp')) return CATEGORY_NLP;
  if (lower.includes('coaching')) return CATEGORY_COACHING;
  return null;
}

// We talk to Dropbox over raw HTTP rather than the official SDK because the
// SDK's filesDownload pulls in node-fetch 2.x semantics (`.buffer()`) that
// don't exist on modern Node's built-in fetch. Two endpoints suffice:
//   POST https://api.dropboxapi.com/2/files/list_folder      (list + paginate)
//   POST https://content.dropboxapi.com/2/files/download     (binary download)

const API_BASE = 'https://api.dropboxapi.com/2';
const CONTENT_BASE = 'https://content.dropboxapi.com/2';
const OAUTH_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

// Module-scoped cache for refreshed access tokens. Avoids hitting the oauth
// endpoint on every Dropbox call.
let cachedAccessToken = null; // { token, expiresAt }

function hasRefreshFlow() {
  return Boolean(
    process.env.DROPBOX_REFRESH_TOKEN &&
    process.env.DROPBOX_APP_KEY &&
    process.env.DROPBOX_APP_SECRET
  );
}

async function exchangeRefreshToken() {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
  });
  const basic = Buffer.from(
    `${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`
  ).toString('base64');

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox token refresh failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  // Refresh ~60s before expiry to avoid races.
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in || 14400) * 1000) - 60_000,
  };
  return cachedAccessToken.token;
}

async function getAccessToken({ forceRefresh = false } = {}) {
  if (hasRefreshFlow()) {
    if (!forceRefresh && cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
      return cachedAccessToken.token;
    }
    return exchangeRefreshToken();
  }

  // Legacy path: static long-lived (or now-short-lived) access token.
  const legacy = process.env.DROPBOX_ACCESS_TOKEN;
  if (!legacy) {
    throw new Error('Dropbox not configured: set DROPBOX_REFRESH_TOKEN + DROPBOX_APP_KEY + DROPBOX_APP_SECRET (preferred), or DROPBOX_ACCESS_TOKEN (legacy)');
  }
  return legacy;
}

function isExpiredTokenError(status, bodyText) {
  if (status !== 401) return false;
  return typeof bodyText === 'string' && /expired_access_token|invalid_access_token/i.test(bodyText);
}

async function api(endpoint, body) {
  const doRequest = async (token) => fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let token = await getAccessToken();
  let res = await doRequest(token);
  if (!res.ok && hasRefreshFlow()) {
    const text = await res.text();
    if (isExpiredTokenError(res.status, text)) {
      cachedAccessToken = null;
      token = await getAccessToken({ forceRefresh: true });
      res = await doRequest(token);
    } else {
      throw new Error(`Dropbox ${endpoint} HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox ${endpoint} HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export function isConfigured() {
  return (hasRefreshFlow() || Boolean(process.env.DROPBOX_ACCESS_TOKEN)) &&
    typeof process.env.DROPBOX_KNOWLEDGE_FOLDER === 'string';
}

function fileExtension(filename) {
  const m = (filename || '').match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : '';
}

/**
 * List all files (recursively) under the configured Dropbox folder.
 * Returns [{ path, name, size, contentHash, updatedAt }].
 */
async function listAllFiles() {
  const folder = process.env.DROPBOX_KNOWLEDGE_FOLDER || '';
  const out = [];
  let res = await api('files/list_folder', { path: folder, recursive: true, limit: 1000 });
  while (true) {
    for (const entry of res.entries) {
      if (entry['.tag'] !== 'file') continue;
      const ext = fileExtension(entry.name);
      if (!SUPPORTED_EXT.has(ext)) continue;
      out.push({
        path: entry.path_display || entry.path_lower,
        name: entry.name,
        size: entry.size,
        contentHash: entry.content_hash,
        updatedAt: entry.server_modified,
      });
    }
    if (!res.has_more) break;
    res = await api('files/list_folder/continue', { cursor: res.cursor });
  }
  return out;
}

async function downloadFile(path) {
  // Dropbox's content endpoint puts the JSON arg in a header instead of body.
  const doRequest = async (token) => fetch(`${CONTENT_BASE}/files/download`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });

  let token = await getAccessToken();
  let res = await doRequest(token);
  if (!res.ok && hasRefreshFlow()) {
    const text = await res.text();
    if (isExpiredTokenError(res.status, text)) {
      cachedAccessToken = null;
      token = await getAccessToken({ forceRefresh: true });
      res = await doRequest(token);
    } else {
      throw new Error(`Dropbox download HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox download HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Sync the configured Dropbox folder once. Returns a summary of what
 * happened, suitable for logging.
 */
export async function runSyncOnce({ logger = console } = {}) {
  if (!isConfigured()) {
    return { skipped: 'dropbox not configured' };
  }

  const summary = { listed: 0, ingested: 0, unchanged: 0, errors: [] };

  let files;
  try {
    files = await listAllFiles();
  } catch (err) {
    logger.error('[dropbox] list failed:', err.message);
    summary.errors.push({ stage: 'list', message: err.message });
    return summary;
  }

  summary.listed = files.length;

  for (const file of files) {
    try {
      const buf = await downloadFile(file.path);
      const ext = fileExtension(file.name);
      const text = await extractTextByExtension(ext, buf);
      const result = await ingestDocument({
        source: `dropbox:${file.path}`,
        text,
        category: categoryFromPath(file.path),
        metadata: { filename: file.name, dropboxContentHash: file.contentHash },
      });
      if (result.status === 'ingested') summary.ingested += 1;
      else if (result.status === 'unchanged') summary.unchanged += 1;
    } catch (err) {
      logger.warn(`[dropbox] failed for ${file.path}: ${err.message}`);
      summary.errors.push({ stage: 'ingest', file: file.path, message: err.message });
    }
  }

  logger.log(`[dropbox] sync done — listed=${summary.listed}, ingested=${summary.ingested}, unchanged=${summary.unchanged}, errors=${summary.errors.length}`);
  return summary;
}

export const __testing = { listAllFiles, downloadFile };
