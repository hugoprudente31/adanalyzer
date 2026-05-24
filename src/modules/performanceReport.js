/**
 * AdAnalyzer — performanceReport.js
 * Relatório consolidado de performance por loja com scoring automático.
 */

const { groupByStore } = require("./storeConsolidation");

const THRESHOLDS = {
  CTR: { excellent: 3.0, good: 1.0, warning: 0.3 },
  CPC: { excellent: 0.30, good: 1.00, warning: 2.00 },
  CPA: { excellent: 0.05, good: 0.30, warning: 1.00 },
};

function scoreMetric(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t) return "neutral";
  if (metric === "CTR") {
    if (value >= t.excellent) return "excellent";
    if (value >= t.good)      return "good";
    if (value >= t.warning)   return "warning";
    return "critical";
  }
  if (value <= t.excellent) return "excellent";
  if (value <= t.good)      return "good";
  if (value <= t.warning)   return "warning";
  return "critical";
}

function calcVariation(current, previous) {
  if (!previous || previous === 0) return null;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

function generateReport(currentCampaigns, previousCampaigns = []) {
  const currentByStore  = groupByStore(currentCampaigns);
  const previousByStore = groupByStore(previousCampaigns);

  const stores = Object.values(currentByStore).map((storeData) => {
    const prev = previousByStore[storeData.store]?.totals || null;
    const curr = storeData.totals;

    return {
      store:          storeData.store,
      color:          storeData.color,
      whatsapp:       storeData.whatsapp,
      activeCampaigns: storeData.campaigns.filter(
        (c) => c.status === "ACTIVE" || c.status === "ENABLED"
      ).length,
      totalCampaigns: storeData.campaigns.length,
      metrics: {
        spend: {
          value:     curr.spend,
          previous:  prev?.spend || null,
          variation: calcVariation(curr.spend, prev?.spend),
          formatted: `R$ ${curr.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        },
        impressions: {
          value:     curr.impressions,
          variation: calcVariation(curr.impressions, prev?.impressions),
          formatted: curr.impressions.toLocaleString("pt-BR"),
        },
        clicks: {
          value:     curr.clicks,
          variation: calcVariation(curr.clicks, prev?.clicks),
          formatted: curr.clicks.toLocaleString("pt-BR"),
        },
        actions: {
          value:     curr.actions,
          variation: calcVariation(curr.actions, prev?.actions),
          formatted: curr.actions.toLocaleString("pt-BR"),
        },
        ctr: { value: curr.ctr, score: scoreMetric("CTR", curr.ctr), formatted: `${curr.ctr.toFixed(2)}%` },
        cpc: { value: curr.cpc, score: scoreMetric("CPC", curr.cpc), formatted: `R$ ${curr.cpc.toFixed(2)}` },
        cpa: { value: curr.cpa, score: scoreMetric("CPA", curr.cpa), formatted: `R$ ${curr.cpa.toFixed(4)}` },
      },
      topCampaigns: storeData.campaigns
        .sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))
        .slice(0, 5)
        .map((c) => ({
          name:    c.campaign_name || c.name,
          spend:   Number(c.spend || 0).toFixed(2),
          actions: typeof c.actions === "object" && Array.isArray(c.actions)
            ? c.actions.reduce((s, a) => s + Number(a.value || 0), 0)
            : Number(c.actions || 0),
          ctr:    c.ctr ? `${Number(c.ctr).toFixed(2)}%` : "-",
          status: c.status,
        })),
    };
  });

  const grand = stores.reduce(
    (acc, s) => {
      acc.spend       += s.metrics.spend.value;
      acc.impressions += s.metrics.impressions.value;
      acc.clicks      += s.metrics.clicks.value;
      acc.actions     += s.metrics.actions.value;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, actions: 0 }
  );

  grand.ctr = grand.impressions > 0 ? (grand.clicks / grand.impressions) * 100 : 0;
  grand.cpc = grand.clicks > 0     ? grand.spend / grand.clicks               : 0;
  grand.cpa = grand.actions > 0    ? grand.spend / grand.actions              : 0;

  return {
    generatedAt: new Date().toISOString(),
    period:      "last_30_days",
    grandTotal: {
      spend:       parseFloat(grand.spend.toFixed(2)),
      impressions: grand.impressions,
      clicks:      grand.clicks,
      actions:     grand.actions,
      ctr:         parseFloat(grand.ctr.toFixed(2)),
      cpc:         parseFloat(grand.cpc.toFixed(2)),
      cpa:         parseFloat(grand.cpa.toFixed(4)),
    },
    stores: stores.sort((a, b) => b.metrics.spend.value - a.metrics.spend.value),
  };
}

module.exports = { generateReport, scoreMetric, calcVariation, THRESHOLDS };
