#!/usr/bin/env node
import { retrieveByCategory, retrieveRelevant, getRuntimeInfo, CATEGORY_NLP, CATEGORY_COACHING } from '../server/services/knowledge-base.js';

console.log('runtime:', JSON.stringify(await getRuntimeInfo(), null, 2));

const queries = [
  'I keep replaying every conversation and looking for what I did wrong',
  'How do I stop people-pleasing and stay in my power',
  'My partner shut down emotionally and I went into rescue mode',
];

for (const q of queries) {
  console.log('\n========== QUERY ==========');
  console.log(q);
  console.log('---');

  const grouped = await retrieveByCategory(q, {
    categories: [CATEGORY_NLP, CATEGORY_COACHING],
    topKPerCategory: 3,
  });

  for (const [cat, hits] of Object.entries(grouped)) {
    console.log(`\n[${cat}] ${hits.length} hits`);
    hits.forEach((h, i) => {
      console.log(`  ${i + 1}. score=${(h.score || 0).toFixed(3)} | ${h.source.split('/').pop().slice(0, 60)}`);
      console.log(`     ${(h.text || '').slice(0, 180).replace(/\s+/g, ' ')}...`);
    });
  }
}
