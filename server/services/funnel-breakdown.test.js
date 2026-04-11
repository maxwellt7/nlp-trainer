import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFunnelBreakdown } from './funnel-breakdown.js';

test('buildFunnelBreakdown calculates counts, conversion rates, and drop-offs for each stage', () => {
  const stages = buildFunnelBreakdown({
    quizPageViews: 120,
    quizLeads: 48,
    offerClicks: 24,
    purchases: 6,
  });

  assert.deepEqual(
    stages.map(({ key, count, conversionFromPrevious, dropOffFromPrevious, dropOffRateFromPrevious }) => ({
      key,
      count,
      conversionFromPrevious,
      dropOffFromPrevious,
      dropOffRateFromPrevious,
    })),
    [
      {
        key: 'quiz_page_views',
        count: 120,
        conversionFromPrevious: null,
        dropOffFromPrevious: null,
        dropOffRateFromPrevious: null,
      },
      {
        key: 'quiz_leads',
        count: 48,
        conversionFromPrevious: 40,
        dropOffFromPrevious: 72,
        dropOffRateFromPrevious: 60,
      },
      {
        key: 'offer_clicks',
        count: 24,
        conversionFromPrevious: 50,
        dropOffFromPrevious: 24,
        dropOffRateFromPrevious: 50,
      },
      {
        key: 'purchases',
        count: 6,
        conversionFromPrevious: 25,
        dropOffFromPrevious: 18,
        dropOffRateFromPrevious: 75,
      },
    ]
  );
});

test('buildFunnelBreakdown prevents impossible negative drop-offs when historical tracking is incomplete', () => {
  const stages = buildFunnelBreakdown({
    quizPageViews: 40,
    quizLeads: 12,
    offerClicks: 0,
    purchases: 3,
  });

  assert.equal(stages[2].conversionFromPrevious, 0);
  assert.equal(stages[2].dropOffFromPrevious, 12);
  assert.equal(stages[2].dropOffRateFromPrevious, 100);
  assert.equal(stages[3].conversionFromPrevious, 100);
  assert.equal(stages[3].dropOffFromPrevious, 0);
  assert.equal(stages[3].dropOffRateFromPrevious, 0);
});
