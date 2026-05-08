// OpenAI embeddings wrapper.
//
// Pinecone index dimension drives the (model, dimensions) pairing so config
// drift can't silently produce wrong-dimension vectors.
//
// Supported pairings:
//   1536 → text-embedding-3-small (its native size)
//   2048 → text-embedding-3-large reduced via the `dimensions` parameter
//   3072 → text-embedding-3-large (its native size)
//
// text-embedding-3-large supports any dimensions value <= 3072; OpenAI
// applies Matryoshka truncation so the shorter vector is still semantically
// meaningful (recommended approach over interpolating).

import OpenAI from 'openai';

const DIM_TO_CONFIG = {
  1536: { model: 'text-embedding-3-small' },
  2048: { model: 'text-embedding-3-large', dimensions: 2048 },
  3072: { model: 'text-embedding-3-large' },
};

let _client = null;
function getClient() {
  if (_client) return _client;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }
  _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export function modelForDimension(dim) {
  const cfg = DIM_TO_CONFIG[dim];
  if (!cfg) {
    throw new Error(
      `Unsupported Pinecone index dimension: ${dim}. Expected 1536, 2048, or 3072.`,
    );
  }
  return cfg.model;
}

export function configForDimension(dim) {
  const cfg = DIM_TO_CONFIG[dim];
  if (!cfg) throw new Error(`Unsupported Pinecone index dimension: ${dim}`);
  return cfg;
}

/**
 * Embed an array of texts. Batches into up-to-100 inputs per request.
 *
 * @param {string[]} texts
 * @param {object} opts
 * @param {string} opts.model — embedding model name (e.g. text-embedding-3-large)
 * @param {number} [opts.dimensions] — optional output size (must match index dim if set)
 * @returns {Promise<number[][]>} one vector per input, in the same order.
 */
export async function embedBatch(texts, { model, dimensions } = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  if (!model) throw new Error('embedBatch: model is required');

  const client = getClient();
  const out = [];
  const batchSize = 100;
  const params = { model };
  if (dimensions) params.dimensions = dimensions;

  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize);
    const r = await client.embeddings.create({ ...params, input: slice });
    for (const item of r.data) {
      out[item.index + i] = item.embedding;
    }
  }
  return out;
}

export async function embedQuery(text, opts = {}) {
  const [vec] = await embedBatch([text], opts);
  return vec;
}
