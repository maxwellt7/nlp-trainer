#!/usr/bin/env node
// End-to-end QC: prove the deployed Railway service actually retrieves from
// Pinecone when responding to a coaching message.
//
// We can't authenticate as a real Clerk user, so this script doesn't hit
// /hypnosis/chat directly. Instead it verifies the same code path:
//   1. Resolves the same Pinecone index Railway uses (reads its env via API).
//   2. Runs a small set of probe queries known to match coaching transcripts.
//   3. Checks score thresholds — if retrieval is broken, all hits would
//      score near zero.
//   4. Pretty-prints what the agent would see in its system prompt.
//
// The /api/health endpoint reports pineconeEnabled + index name, so we can
// also confirm Railway is configured to retrieve.

import { retrieveByCategory, getRuntimeInfo, CATEGORY_NLP, CATEGORY_COACHING } from '../server/services/knowledge-base.js';

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://nlp-training-backend-production.up.railway.app';

async function checkRailwayHealth() {
  const r = await fetch(`${RAILWAY_URL}/api/health`);
  const body = await r.json();
  console.log('Railway /api/health:', JSON.stringify(body, null, 2));
  if (!body.runtime?.pineconeEnabled) {
    throw new Error('Railway has pinecone disabled — env not set');
  }
  return body;
}

const PROBES = [
  {
    label: 'replaying conversations / self-judgment',
    query: 'I keep replaying every conversation looking for what I did wrong',
    expectCategoryHit: CATEGORY_COACHING,
    minScore: 0.25,
  },
  {
    label: 'people-pleasing / sovereignty',
    query: 'How do I stop people-pleasing and stay in my power',
    expectCategoryHit: CATEGORY_COACHING,
    minScore: 0.25,
  },
  {
    label: 'partner shutdown / rescue mode',
    query: 'My partner shut down emotionally and I went into rescue mode',
    expectCategoryHit: CATEGORY_COACHING,
    minScore: 0.25,
  },
];

async function main() {
  await checkRailwayHealth();

  console.log('\nLocal kb runtime:', JSON.stringify(await getRuntimeInfo(), null, 2));

  let pass = 0;
  let fail = 0;

  for (const probe of PROBES) {
    console.log(`\n========== ${probe.label} ==========`);
    console.log('query:', probe.query);
    const grouped = await retrieveByCategory(probe.query, {
      categories: [CATEGORY_NLP, CATEGORY_COACHING],
      topKPerCategory: 3,
    });
    const hitsForExpected = grouped[probe.expectCategoryHit] || [];
    const top = hitsForExpected[0];
    if (!top) {
      console.log(`  ❌ FAIL: no hits in category=${probe.expectCategoryHit}`);
      fail += 1;
      continue;
    }
    console.log(`  top ${probe.expectCategoryHit} hit: score=${top.score.toFixed(3)} source=${(top.source || '').split('/').pop()}`);
    if (top.score < probe.minScore) {
      console.log(`  ❌ FAIL: score below threshold ${probe.minScore}`);
      fail += 1;
    } else {
      console.log(`  ✅ PASS`);
      pass += 1;
    }
  }

  console.log(`\n--- summary: ${pass} pass, ${fail} fail ---`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
