/**
 * AdAnalyzer — supermetrics.service.js
 * Integração com Supermetrics para Google Ads, GA4 e Search Console.
 */

const ACCOUNTS = require("../config/accounts.config");

const SUPERMETRICS_MCP_URL = process.env.SUPERMETRICS_MCP_URL || "https://mcp.supermetrics.com/mcp";

async function supermetricsQuery(tool, params) {
  const response = await fetch(`${SUPERMETRICS_MCP_URL}/tools/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await response.json();
  if (!data.success && data.error) {
    throw new Error(`Supermetrics Error [${tool}]: ${data.error}`);
  }
  return data;
}

// ── Google Ads ────────────────────────────────────────────────

async function getAllGoogleAdsMetrics({ datePreset = "last_30_days", fields = "campaign,impressions,clicks,cost,ctr,average_cpc,conversions" } = {}) {
  return supermetricsQuery("data_query", {
    ds_id: "AW",
    ds_accounts: ACCOUNTS.allGoogleAdsIds,
    date_range_type: datePreset,
    fields,
    settings: { report_type: "campaign" },
  });
}

async function getGoogleAdsMetrics(accountIdOrSlug, options = {}) {
  const account = ACCOUNTS.findGoogleAds(accountIdOrSlug);
  if (!account) throw new Error(`Conta Google Ads não encontrada: ${accountIdOrSlug}`);

  const { datePreset = "last_30_days", fields = "campaign,impressions,clicks,cost,ctr,average_cpc,conversions", reportType = "campaign", startDate, endDate } = options;

  const params = { ds_id: "AW", ds_accounts: account.id, fields, settings: { report_type: reportType } };
  if (startDate && endDate) { params.date_range_type = "custom"; params.start_date = startDate; params.end_date = endDate; }
  else params.date_range_type = datePreset;

  return supermetricsQuery("data_query", params);
}

async function getGoogleAdsDashboard() {
  const results = await Promise.allSettled(
    ACCOUNTS.googleAds.map((account) =>
      supermetricsQuery("data_query", {
        ds_id: "AW",
        ds_accounts: account.id,
        date_range_type: "last_30_days",
        fields: "impressions,clicks,cost,ctr,average_cpc,conversions,cost_per_conversion",
        settings: { report_type: "account" },
      }).then((data) => ({ account, data }))
    )
  );

  return results.map((result, i) => ({
    account: ACCOUNTS.googleAds[i],
    metrics: result.status === "fulfilled" ? result.value.data : null,
    error:   result.status === "rejected"  ? result.reason?.message : null,
  }));
}

async function compareAccounts({ datePreset = "last_30_days", metric = "cost" } = {}) {
  const dashboard = await getGoogleAdsDashboard();
  return dashboard
    .filter((d) => d.metrics)
    .map((d) => ({ name: d.account.name, slug: d.account.slug, color: d.account.color, ...d.metrics }))
    .sort((a, b) => (parseFloat(b[metric]) || 0) - (parseFloat(a[metric]) || 0));
}

// ── Google Analytics 4 ────────────────────────────────────────

async function getGA4Metrics(propertyIdOrSlug, options = {}) {
  const property = ACCOUNTS.findGA4(propertyIdOrSlug);
  if (!property) throw new Error(`Propriedade GA4 não encontrada: ${propertyIdOrSlug}`);

  const { datePreset = "last_30_days", fields = "sessions,users,new_users,bounce_rate,avg_session_duration,conversions", startDate, endDate } = options;

  const params = { ds_id: "GAWA", ds_accounts: property.id, fields };
  if (startDate && endDate) { params.date_range_type = "custom"; params.start_date = startDate; params.end_date = endDate; }
  else params.date_range_type = datePreset;

  return supermetricsQuery("data_query", params);
}

async function getAllGA4Metrics(options = {}) {
  const results = await Promise.allSettled(
    ACCOUNTS.googleAnalytics.map((property) =>
      getGA4Metrics(property.id, options).then((data) => ({ property, data }))
    )
  );
  return results.map((result, i) => ({
    property: ACCOUNTS.googleAnalytics[i],
    metrics: result.status === "fulfilled" ? result.value.data : null,
    error:   result.status === "rejected"  ? result.reason?.message : null,
  }));
}

// ── Google Search Console ─────────────────────────────────────

async function getSearchConsoleMetrics({ datePreset = "last_30_days", fields = "query,clicks,impressions,ctr,position", startDate, endDate } = {}) {
  const site = ACCOUNTS.searchConsole[0];
  const params = { ds_id: "GW", ds_accounts: site.id, fields, settings: { data_precision: "1_NORMAL" } };
  if (startDate && endDate) { params.date_range_type = "custom"; params.start_date = startDate; params.end_date = endDate; }
  else params.date_range_type = datePreset;
  return supermetricsQuery("data_query", params);
}

async function getTopKeywords({ limit = 20, datePreset = "last_30_days" } = {}) {
  return getSearchConsoleMetrics({ datePreset, fields: "query,clicks,impressions,ctr,position" });
}

// ── Relatório Consolidado ─────────────────────────────────────

async function getFullReport({ datePreset = "last_30_days" } = {}) {
  const [googleAds, ga4, searchConsole] = await Promise.allSettled([
    getGoogleAdsDashboard(),
    getAllGA4Metrics({ datePreset }),
    getSearchConsoleMetrics({ datePreset }),
  ]);

  return {
    period: datePreset,
    generatedAt: new Date().toISOString(),
    googleAds:     googleAds.status     === "fulfilled" ? googleAds.value     : { error: googleAds.reason?.message },
    ga4:           ga4.status           === "fulfilled" ? ga4.value           : { error: ga4.reason?.message },
    searchConsole: searchConsole.status === "fulfilled" ? searchConsole.value : { error: searchConsole.reason?.message },
  };
}

module.exports = {
  getAllGoogleAdsMetrics, getGoogleAdsMetrics, getGoogleAdsDashboard, compareAccounts,
  getGA4Metrics, getAllGA4Metrics,
  getSearchConsoleMetrics, getTopKeywords,
  getFullReport,
  ACCOUNTS,
};
