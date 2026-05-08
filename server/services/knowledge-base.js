// Knowledge-base service: ingest documents into Pinecone, retrieve relevant
// chunks for a query at chat time.
//
// Setup:
//   - PINECONE_API_KEY, PINECONE_INDEX_KNOWLEDGE, PINECONE_ENVIRONMENT must
//     be set in env. ENABLE_PINECONE must be 'true'.
//   - Two index modes are supported:
//     1. Integrated inference: Pinecone hosts the embedding model
//        (e.g. llama-text-embed-v2). Detected via describeIndex().embed
//        being present. Uses upsertRecords/searchRecords — no external
//        embedding API needed.
//     2. Standalone: we run OpenAI embeddings client-side. Used when no
//        integrated model is configured. Index dimension must be 1536/2048/3072.
//
// Idempotent ingestion: each chunk's id is derived from the source path +
// chunkIndex, so re-ingesting the same document with the same content does
// not duplicate vectors. Document-level changes are tracked in a
// kb_documents table by content-hash so we can skip unchanged files
// without round-tripping every chunk.

import crypto from 'node:crypto';
import { Pinecone } from '@pinecone-database/pinecone';
import db from '../db/index.js';
import { chunkDocument } from './chunking.js';
import { embedBatch, embedQuery, configForDimension } from './embeddings.js';

const NAMESPACE = process.env.PINECONE_NAMESPACE || '__default__';

// Recognized knowledge categories. Adding a new category? Just pass any
// string — it propagates straight into Pinecone metadata. These constants
// are exported so callers don't have to hardcode strings.
export const CATEGORY_NLP = 'nlp';
export const CATEGORY_COACHING = 'coaching';

let _pinecone = null;
let _index = null;
let _indexDimension = null;
let _embedConfig = null;            // OpenAI embed config (standalone mode only)
let _integrated = false;            // true when Pinecone hosts the embedding model
let _integratedFieldMap = null;     // e.g. { text: 'text' } — names the source field

export function isEnabled() {
  return process.env.ENABLE_PINECONE === 'true' &&
    Boolean(process.env.PINECONE_API_KEY) &&
    Boolean(process.env.PINECONE_INDEX_KNOWLEDGE);
}

async function getIndex() {
  if (_index) return _index;
  if (!isEnabled()) {
    throw new Error('Knowledge base disabled — set ENABLE_PINECONE=true and PINECONE_API_KEY/PINECONE_INDEX_KNOWLEDGE.');
  }

  _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const indexName = process.env.PINECONE_INDEX_KNOWLEDGE;

  const description = await _pinecone.describeIndex(indexName);
  _indexDimension = description.dimension;

  if (description.embed && description.embed.model) {
    _integrated = true;
    _integratedFieldMap = description.embed.fieldMap || { text: 'text' };
    _embedConfig = null;
  } else {
    _integrated = false;
    _embedConfig = configForDimension(_indexDimension);
  }

  _index = _pinecone.index(indexName);
  return _index;
}

export async function getRuntimeInfo() {
  if (!isEnabled()) return { enabled: false };
  await getIndex();
  return {
    enabled: true,
    indexName: process.env.PINECONE_INDEX_KNOWLEDGE,
    dimension: _indexDimension,
    mode: _integrated ? 'integrated-inference' : 'standalone-openai',
    namespace: NAMESPACE,
    ...(_integrated
      ? { integratedFieldMap: _integratedFieldMap }
      : { embeddingModel: _embedConfig.model, embeddingDimensions: _embedConfig.dimensions || _indexDimension }),
  };
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function chunkId(source, chunkIndex) {
  // Deterministic, stable id per (source, chunk) so re-upserting overwrites
  // the same vector instead of creating duplicates.
  return `${source.replace(/[^a-zA-Z0-9._/-]/g, '_').slice(0, 200)}#${chunkIndex}`;
}

function ensureKbTable() {
  // Lazily ensure the dedup table exists. The main schema in db/index.js
  // doesn't have it yet because RAG was added later — keeps migrations
  // out of the critical startup path.
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_documents (
      source       TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      chunk_count  INTEGER NOT NULL DEFAULT 0,
      category     TEXT DEFAULT NULL,
      ingested_at  TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now'))
    );
  `);
  // Best-effort migration for older deployments that already have the
  // table without the category column. sql.js raises if column exists; ignore.
  try { db.exec(`ALTER TABLE kb_documents ADD COLUMN category TEXT DEFAULT NULL`); } catch { /* already there */ }
}

function getStoredHash(source) {
  ensureKbTable();
  const row = db.prepare('SELECT content_hash, chunk_count FROM kb_documents WHERE source = ?').get(source);
  return row || null;
}

function recordIngest(source, contentHash, chunkCount, category = null) {
  ensureKbTable();
  const existing = getStoredHash(source);
  if (existing) {
    db.prepare(
      "UPDATE kb_documents SET content_hash = ?, chunk_count = ?, category = ?, updated_at = datetime('now') WHERE source = ?"
    ).run(contentHash, chunkCount, category, source);
  } else {
    db.prepare(
      'INSERT INTO kb_documents (source, content_hash, chunk_count, category) VALUES (?, ?, ?, ?)'
    ).run(source, contentHash, chunkCount, category);
  }
}

/**
 * Ingest a single document: chunk → upsert to Pinecone.
 * Embedding is done on the Pinecone side (integrated inference) or
 * client-side via OpenAI (standalone), depending on the index configuration.
 *
 * @param {object} args
 * @param {string} args.source — stable identifier (e.g. dropbox path or file basename)
 * @param {string} args.text — extracted plain text
 * @param {string} [args.category] — bucket label like 'nlp' or 'coaching' that
 *   propagates into vector metadata so we can filter at retrieval time.
 * @param {object} [args.metadata] — extra metadata to attach to each chunk vector
 * @returns {Promise<{ source, chunkCount, status: 'ingested' | 'unchanged' | 'empty' }>}
 */
export async function ingestDocument({ source, text, category = null, metadata = {} }) {
  if (!source) throw new Error('ingestDocument: source is required');
  if (typeof text !== 'string' || !text.trim()) {
    return { source, chunkCount: 0, status: 'empty' };
  }

  const contentHash = sha256Hex(Buffer.from(text, 'utf8'));
  const stored = getStoredHash(source);
  if (stored && stored.content_hash === contentHash) {
    return { source, chunkCount: stored.chunk_count, status: 'unchanged' };
  }

  const chunks = chunkDocument(text);
  if (chunks.length === 0) {
    return { source, chunkCount: 0, status: 'empty' };
  }

  await getIndex();

  if (_integrated) {
    // Integrated inference: Pinecone embeds the configured `text` field
    // server-side. We push records as plain JSON; metadata is whatever
    // additional fields we attach.
    const textField = _integratedFieldMap.text || 'text';
    const ns = _index.namespace(NAMESPACE);
    const records = chunks.map((c) => ({
      _id: chunkId(source, c.chunkIndex),
      [textField]: c.text,
      source,
      chunkIndex: c.chunkIndex,
      charStart: c.charStart,
      charEnd: c.charEnd,
      ...(category ? { category } : {}),
      ...metadata,
    }));
    // upsertRecords accepts up to 96 records per call per Pinecone docs.
    const batchSize = 90;
    for (let i = 0; i < records.length; i += batchSize) {
      await ns.upsertRecords({ records: records.slice(i, i + batchSize) });
    }
    recordIngest(source, contentHash, records.length, category);
    return { source, chunkCount: records.length, status: 'ingested' };
  }

  // Standalone mode: embed client-side, then upsert vectors.
  const vectors = await embedBatch(chunks.map((c) => c.text), _embedConfig);
  const records = chunks.map((c, i) => ({
    id: chunkId(source, c.chunkIndex),
    values: vectors[i],
    metadata: {
      source,
      chunkIndex: c.chunkIndex,
      charStart: c.charStart,
      charEnd: c.charEnd,
      text: c.text,
      ...(category ? { category } : {}),
      ...metadata,
    },
  }));
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    await _index.upsert(records.slice(i, i + batchSize));
  }
  recordIngest(source, contentHash, records.length, category);
  return { source, chunkCount: records.length, status: 'ingested' };
}

/**
 * Retrieve top-k chunks relevant to the query. Returns [] silently when
 * disabled (caller can decide whether to fall back to no-RAG).
 *
 * Optional category filter: when set, restricts retrieval to chunks tagged
 * with that category in their metadata. Pass null/undefined to search all.
 */
export async function retrieveRelevant(query, { topK = 5, category = null } = {}) {
  if (!isEnabled()) return [];
  if (typeof query !== 'string' || !query.trim()) return [];

  try {
    await getIndex();

    if (_integrated) {
      const ns = _index.namespace(NAMESPACE);
      const searchRequest = {
        query: {
          topK,
          inputs: { text: query },
        },
        fields: ['source', 'chunkIndex', 'category', 'text'],
      };
      if (category) {
        searchRequest.query.filter = { category: { $eq: category } };
      }
      const result = await ns.searchRecords(searchRequest);
      const hits = result?.result?.hits || [];
      return hits.map((h) => ({
        score: h._score ?? 0,
        source: h.fields?.source || '',
        chunkIndex: h.fields?.chunkIndex,
        category: h.fields?.category || null,
        text: h.fields?.text || '',
      }));
    }

    const vector = await embedQuery(query, _embedConfig);
    const queryRequest = { vector, topK, includeMetadata: true };
    if (category) queryRequest.filter = { category: { $eq: category } };
    const result = await _index.query(queryRequest);
    return (result.matches || []).map((m) => ({
      score: m.score ?? 0,
      source: m.metadata?.source || '',
      chunkIndex: m.metadata?.chunkIndex,
      category: m.metadata?.category || null,
      text: m.metadata?.text || '',
    }));
  } catch (err) {
    console.warn('[KB] retrieveRelevant failed; continuing without RAG:', err.message);
    return [];
  }
}

/**
 * Convenience: retrieve top-k chunks per category in parallel and return them
 * grouped, so callers can present each set in its own prompt section.
 *
 * @param {string} query
 * @param {object} opts
 * @param {string[]} opts.categories — list of category labels to fetch
 * @param {number} [opts.topKPerCategory=3]
 * @returns {Promise<Record<string, Array<{score,source,chunkIndex,category,text}>>>}
 */
export async function retrieveByCategory(query, { categories, topKPerCategory = 3 } = {}) {
  if (!Array.isArray(categories) || categories.length === 0) return {};
  const results = await Promise.all(
    categories.map(async (cat) => [cat, await retrieveRelevant(query, { topK: topKPerCategory, category: cat })]),
  );
  return Object.fromEntries(results);
}

/**
 * Format retrieved chunks for injection into a system prompt.
 * Includes the source so the model can cite it if needed.
 */
export function formatRetrievedForPrompt(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return '';
  const blocks = chunks.map((c, i) => {
    const head = `[#${i + 1} | source: ${c.source || 'unknown'} | score: ${(c.score || 0).toFixed(3)}]`;
    return `${head}\n${(c.text || '').trim()}`;
  });
  return blocks.join('\n\n---\n\n');
}

/**
 * Reset cached clients — used by tests to reload after env changes.
 */
export function __resetForTesting() {
  _pinecone = null;
  _index = null;
  _indexDimension = null;
  _embedConfig = null;
  _integrated = false;
  _integratedFieldMap = null;
}
