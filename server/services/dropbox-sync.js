// Dropbox → knowledge-base sync.
//
// Runs on a cron interval. Lists all files under DROPBOX_KNOWLEDGE_FOLDER,
// downloads any that have changed since the last successful run, parses the
// content, and feeds it to ingestDocument(). The KB itself dedupes by
// content-hash, so re-running is cheap if nothing has changed.

import { Dropbox } from 'dropbox';
import { extractTextByExtension } from './pdf-parser.js';
import { ingestDocument } from './knowledge-base.js';

const SUPPORTED_EXT = new Set(['pdf', 'txt', 'md', 'markdown']);

let _client = null;
function getClient() {
  if (_client) return _client;
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('DROPBOX_ACCESS_TOKEN is not set');
  }
  _client = new Dropbox({ accessToken, fetch: globalThis.fetch });
  return _client;
}

export function isConfigured() {
  return Boolean(process.env.DROPBOX_ACCESS_TOKEN) &&
    typeof process.env.DROPBOX_KNOWLEDGE_FOLDER === 'string';
}

function fileExtension(filename) {
  const m = (filename || '').match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : '';
}

/**
 * List all files (recursively) under the configured Dropbox folder.
 * Returns [{ path, name, size, contentHash, updatedAt }].
 *
 * `contentHash` is Dropbox's per-file content_hash header — we use it as a
 * cheap "did this change" signal to skip downloading unchanged files.
 */
async function listAllFiles() {
  const client = getClient();
  const folder = process.env.DROPBOX_KNOWLEDGE_FOLDER || '';

  const out = [];
  let res = await client.filesListFolder({ path: folder, recursive: true });
  while (true) {
    for (const entry of res.result.entries) {
      if (entry['.tag'] !== 'file') continue;
      const ext = fileExtension(entry.name);
      if (!SUPPORTED_EXT.has(ext)) continue;
      out.push({
        path: entry.path_lower || entry.path_display,
        name: entry.name,
        size: entry.size,
        contentHash: entry.content_hash,
        updatedAt: entry.server_modified,
      });
    }
    if (!res.result.has_more) break;
    res = await client.filesListFolderContinue({ cursor: res.result.cursor });
  }
  return out;
}

async function downloadFile(path) {
  const client = getClient();
  const res = await client.filesDownload({ path });
  // dropbox SDK returns fileBinary on Node, fileBlob in browsers. We're Node.
  if (res.result.fileBinary) return res.result.fileBinary;
  if (res.result.fileBlob) return Buffer.from(await res.result.fileBlob.arrayBuffer());
  throw new Error(`Dropbox response had no fileBinary for ${path}`);
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
