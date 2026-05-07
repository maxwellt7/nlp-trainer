// OpenAI embeddings wrapper.
//
// We pick the model based on the Pinecone index dimension so config drift
// can't silently produce wrong-dimension vectors.
//
// Supported pairings:
//   1536 dim → text-embedding-3-small  (default, recommended for most KBs)
//   3072 dim → text-embedding-3-large  (higher quality, ~6x cost)
//
// If the index dimension is anything else we throw on init so we fail loud
// rather than upserting incompatible vectors.

import OpenAI from 'openai';

const DIM_TO_MODEL = {
  1536: 'text-embedding-3-small',
  3072: 'text-embedding-3-large',
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
  const model = DIM_TO_MODEL[dim];
  if (!model) {
    throw new Error(
      `Unsupported Pinecone index dimension: ${dim}. Expected 1536 (text-embedding-3-small) or 3072 (text-embedding-3-large).`
    );
  }
  return model;
}

/**
 * Embed an array of texts. Batches into up-to-100 inputs per request (OpenAI
 * limit is 2048 inputs but per-request size matters for latency on retries).
 *
 * @param {string[]} texts
 * @param {object} opts
 * @param {string} opts.model — embedding model name
 * @returns {Promise<number[][]>} one vector per input, in the same order.
 */
export async function embedBatch(texts, { model } = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  if (!model) throw new Error('embedBatch: model is required');

  const client = getClient();
  const out = [];
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize);
    const r = await client.embeddings.create({
      model,
      input: slice,
    });
    for (const item of r.data) {
      out[item.index + i] = item.embedding;
    }
  }
  return out;
}

export async function embedQuery(text, { model } = {}) {
  const [vec] = await embedBatch([text], { model });
  return vec;
}
