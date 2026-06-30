#!/usr/bin/env node
// Ingest the curated NLP corpus (server/data/*.json) into Pinecone so the coach
// can RETRIEVE specifics on demand — complementing the always-on condensed
// digest that now lives in the coaching system prompt.
//
// Run against production Pinecone with the Railway env injected:
//   railway run -- node scripts/ingest-curated-nlp.mjs
//
// Idempotent: chunk ids derive from (source, chunkIndex), so re-running
// overwrites the same vectors rather than duplicating. coaching-frameworks.json
// is tagged 'coaching'; every other curated file is tagged 'nlp'.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadNlpFiles, renderNlpFileForIngest } from '../server/services/nlp-content.js';
import {
  ingestDocument,
  getRuntimeInfo,
  retrieveRelevant,
  CATEGORY_NLP,
  CATEGORY_COACHING,
  isEnabled,
} from '../server/services/knowledge-base.js';

async function main() {
  if (!isEnabled()) {
    console.error('Knowledge base disabled. Need ENABLE_PINECONE=true + PINECONE_API_KEY + PINECONE_INDEX_KNOWLEDGE.');
    process.exit(1);
  }

  const info = await getRuntimeInfo();
  console.log('Pinecone:', JSON.stringify(info));

  const docs = [];
  // The curated NLP technique files (excludes modules.json + coaching-frameworks.json).
  for (const { name, data } of loadNlpFiles()) {
    docs.push({
      source: `curated/nlp/${name}`,
      text: renderNlpFileForIngest(name, data),
      category: CATEGORY_NLP,
    });
  }
  // Coaching frameworks → coaching category.
  try {
    const cf = JSON.parse(readFileSync(join(process.cwd(), 'server/data/coaching-frameworks.json'), 'utf-8'));
    docs.push({
      source: 'curated/coaching/coaching-frameworks',
      text: renderNlpFileForIngest('coaching-frameworks', cf),
      category: CATEGORY_COACHING,
    });
  } catch (err) {
    console.warn('Could not load coaching-frameworks.json:', err.message);
  }

  let totalChunks = 0;
  for (const doc of docs) {
    const res = await ingestDocument(doc);
    totalChunks += res.chunkCount || 0;
    console.log(`  ${res.status.padEnd(9)} ${doc.source}  (${res.chunkCount} chunks, category=${doc.category})`);
  }
  console.log(`\nIngested ${docs.length} documents, ${totalChunks} chunks total.`);

  // Smoke-test retrieval so we know the content is actually queryable.
  console.log('\nRetrieval smoke test:');
  for (const q of ['embedded commands for confidence', 'toward vs away meta program', 'how to handle a limiting belief']) {
    const hits = await retrieveRelevant(q, { topK: 2, category: null });
    const top = hits[0];
    console.log(`  q="${q}" -> ${hits.length} hits` + (top ? `, top source=${top.source} score=${(top.score || 0).toFixed(3)}` : ''));
  }
}

main().catch((err) => {
  console.error('Ingest failed:', err);
  process.exit(1);
});
