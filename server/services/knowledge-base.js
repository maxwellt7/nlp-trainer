// Knowledge-base service: ingest documents into Pinecone, retrieve relevant
// chunks for a query at chat time.
//
// Setup:
//   - PINECONE_API_KEY, PINECONE_INDEX_KNOWLEDGE, PINECONE_ENVIRONMENT must
//     be set in env. ENABLE_PINECONE must be 'true'.
//   - The Pinecone index must already exist with a dimension of 1536 or 3072
//     (we pick the embedding model accordingly).
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
import { embedBatch, embedQuery, modelForDimension } from './embeddings.js';

let _pinecone = null;
let _index = null;
let _indexDimension = null;
let _embeddingModel = null;

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

  // describeIndex tells us the dimension so we pick a matching embedder.
  const description = await _pinecone.describeIndex(indexName);
  _indexDimension = description.dimension;
  _embeddingModel = modelForDimension(_indexDimension);

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
    embeddingModel: _embeddingModel,
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
      ingested_at  TEXT DEFAULT (datetime('now')),
      updated_at   TEXT DEFAULT (datetime('now'))
    );
  `);
}

function getStoredHash(source) {
  ensureKbTable();
  const row = db.prepare('SELECT content_hash, chunk_count FROM kb_documents WHERE source = ?').get(source);
  return row || null;
}

function recordIngest(source, contentHash, chunkCount) {
  ensureKbTable();
  const existing = getStoredHash(source);
  if (existing) {
    db.prepare(
      "UPDATE kb_documents SET content_hash = ?, chunk_count = ?, updated_at = datetime('now') WHERE source = ?"
    ).run(contentHash, chunkCount, source);
  } else {
    db.prepare(
      'INSERT INTO kb_documents (source, content_hash, chunk_count) VALUES (?, ?, ?)'
    ).run(source, contentHash, chunkCount);
  }
}

/**
 * Ingest a single document: chunk → embed → upsert to Pinecone.
 *
 * @param {object} args
 * @param {string} args.source — stable identifier (e.g. dropbox path or file basename)
 * @param {string} args.text — extracted plain text
 * @param {object} [args.metadata] — extra metadata to attach to each chunk vector
 * @returns {Promise<{ source, chunkCount, status: 'ingested' | 'unchanged' }>}
 */
export async function ingestDocument({ source, text, metadata = {} }) {
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
  const vectors = await embedBatch(chunks.map((c) => c.text), { model: _embeddingModel });

  const records = chunks.map((c, i) => ({
    id: chunkId(source, c.chunkIndex),
    values: vectors[i],
    metadata: {
      source,
      chunkIndex: c.chunkIndex,
      charStart: c.charStart,
      charEnd: c.charEnd,
      text: c.text,
      ...metadata,
    },
  }));

  // Pinecone upsert is capped at 100 vectors per call.
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    await _index.upsert(records.slice(i, i + batchSize));
  }

  recordIngest(source, contentHash, records.length);
  return { source, chunkCount: records.length, status: 'ingested' };
}

/**
 * Retrieve top-k chunks relevant to the query. Returns [] silently when
 * disabled (caller can decide whether to fall back to no-RAG).
 */
export async function retrieveRelevant(query, { topK = 5 } = {}) {
  if (!isEnabled()) return [];
  if (typeof query !== 'string' || !query.trim()) return [];

  try {
    await getIndex();
    const vector = await embedQuery(query, { model: _embeddingModel });
    const result = await _index.query({
      vector,
      topK,
      includeMetadata: true,
    });
    return (result.matches || []).map((m) => ({
      score: m.score ?? 0,
      source: m.metadata?.source || '',
      chunkIndex: m.metadata?.chunkIndex,
      text: m.metadata?.text || '',
    }));
  } catch (err) {
    console.warn('[KB] retrieveRelevant failed; continuing without RAG:', err.message);
    return [];
  }
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
  _embeddingModel = null;
}
