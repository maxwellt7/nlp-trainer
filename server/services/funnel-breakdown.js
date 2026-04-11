export function buildFunnelBreakdown({ quizPageViews = 0, quizLeads = 0, offerClicks = 0, purchases = 0 }) {
  const stages = [
    {
      key: 'quiz_page_views',
      label: 'Quiz Traffic',
      description: 'Visits to the quiz route during the selected period.',
      count: Number(quizPageViews) || 0,
    },
    {
      key: 'quiz_leads',
      label: 'Email Captures',
      description: 'Quiz takers who submitted email to unlock results.',
      count: Number(quizLeads) || 0,
    },
    {
      key: 'offer_clicks',
      label: 'Offer Clicks',
      description: 'Users who clicked through from quiz results to the offer page.',
      count: Number(offerClicks) || 0,
    },
    {
      key: 'purchases',
      label: 'Purchases',
      description: 'Paid users provisioned after the checkout flow.',
      count: Number(purchases) || 0,
    },
  ];

  return stages.map((stage, index) => {
    if (index === 0) {
      return {
        ...stage,
        conversionFromPrevious: null,
        dropOffFromPrevious: null,
        dropOffRateFromPrevious: null,
      };
    }

    const previousCount = stages[index - 1].count;
    const currentCount = stage.count;

    if (previousCount <= 0) {
      return {
        ...stage,
        conversionFromPrevious: currentCount > 0 ? 100 : 0,
        dropOffFromPrevious: 0,
        dropOffRateFromPrevious: 0,
      };
    }

    const rawConversion = (currentCount / previousCount) * 100;
    const conversionFromPrevious = Number(Math.min(rawConversion, 100).toFixed(1));
    const dropOffFromPrevious = Math.max(previousCount - currentCount, 0);
    const dropOffRateFromPrevious = Number((100 - conversionFromPrevious).toFixed(1));

    return {
      ...stage,
      conversionFromPrevious,
      dropOffFromPrevious,
      dropOffRateFromPrevious,
    };
  });
}
