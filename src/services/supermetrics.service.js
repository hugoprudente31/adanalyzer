/**
 * AdAnalyzer — supermetrics.service.js (dinâmico)
 * Contas descobertas automaticamente via Supermetrics — sem hardcode.
 */

const discovery = require("./accounts.discovery");

const SUPERMETRICS_MCP_URL = process.env.SUPERMETRICS_MCP_URL || "https://mcp.supermetrics.com/mcp";

async function supermetricsQuery(tool, params) {
  const response = await fetch(`${SUPERMETRICS_MCP_URL}/tools/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, compress: true }),
  });

  const data = await response.json();
  if (!data.success && data.error) throw new Error(`Supermetrics [${tool}]: ${data.error}`);
  return data;
}

// ── Google Ads ────────────────────────────────────────────────

async function getGoogleAdsDashboard({ datePreset = "last_30_days" } = {}) {
  const accounts = await discovery.discoverGoogleAdsAccounts();

  const results = await Promise.allSettled(
    accounts.map((account) =>
      supermetricsQuery("data_query", {
        ds_id: "AW",
        ds_accounts: account.id,
        date_range_type: datePreset,
        fields: "impressions,clicks,cost,ctr,average_cpc,conversions,cost_per_conversion",
        settings: { report_type: "account" },
      }).then((data) => ({ account, data }))
    )
  );

  return results.map((result, i) => ({
    account: accounts[i],
    metrics: result.status === "fulfilled" ? result.value.data : null,
    error:   result.status === "rejected"  ? result.reason?.message : null,
  }));
}

async function getGoogleAdsMetrics(query, options = {}) {
  const account = await discovery.findGoogleAdsAccount(query);
  if (!account) throw new Error(`Conta Google Ads não encontrada: "${query}"`);

  const { datePreset = "last_30_days", startDate, endDate, reportType = "campaign", fields = "campaign,impressions,clicks,cost,ctr,average_cpc,conversions" } = options;

  const params = { ds_id: "AW", ds_accounts: account.id, fields, settings: { report_type: reportType } };
  if (startDate && endDate) { params.date_range_type = "custom"; params.start_date = startDate; params.end_date = endDate; }
  else params.date_range_type = datePreset;

  const data = await supermetricsQuery("data_query", params);
  return { account, data };
}

async function compareGoogleAdsAccounts({ datePreset = "last_30_days", metric = "cost" } = {}) {
  const dashboard = await getGoogleAdsDashboard({ datePreset });
  return dashboard
    .filter((d) => d.metrics)
    .map((d) => ({ id: d.account.id, name: d.account.name, isMCC: d.account.isMCC, ...d.metrics }))
    .sort((a, b) => (parseFloat(b[metric]) || 0) - (parseFloat(a[metric]) || 0));
}

// ── GA4 ───────────────────────────────────────────────────────

async function getAllGA4Metrics({ datePreset = "last_30_days", fields } = {}) {
  const properties = await discovery.discoverGA4Accounts();
  const defaultFields = "sessions,users,new_users,bounce_rate,avg_session_duration,conversions";

  const results = await Promise.allSettled(
    properties.map((property) =>
      supermetricsQuery("data_query", {
        ds_id: "GAWA", ds_accounts: property.id,
        date_range_type: datePreset, fields: fields || defaultFields,
      }).then((data) => ({ property, data }))
    )
  );

  return results.map((result, i) => ({
    property: properties[i],
    metrics: result.status === "fulfilled" ? result.value.data : null,
    error:   result.status === "rejected"  ? result.reason?.message : null,
  }));
}

async function getGA4Metrics(query, options = {}) {
  const property = await discovery.findGA4Account(query);
  if (!property) throw new Error(`Propriedade GA4 não encontrada: "${query}"`);

  const { datePreset = "last_30_days", startDate, endDate, fields = "sessions,users,new_users,bounce_rate,avg_session_duration,conversions" } = options;

  const params = { ds_id: "GAWA", ds_accounts: property.id, fields };
  if (startDate && endDate) { params.date_range_type = "custom"; params.start_date = startDate; params.end_date = endDate; }
  else params.date_range_type = datePreset;

  const data = await supermetricsQuery("data_query", params);
  return { property, data };
}

// ── Search Console ────────────────────────────────────────────

async function getSearchConsoleMetrics({ datePreset = "last_30_days", startDate, endDate, fields = "query,clicks,impressions,ctr,position" } = {}) {
  const sites = await discovery.discoverSearchConsoleAccounts();

  const results = await Promise.allSettled(
    sites.map((site) => {
      const params = { ds_id: "GW", ds_accounts: site.id, fields, settings: { data_precision: "1_NORMAL" } };
      if (startDate && endDate) { params.date_range_type = "custom"; params.start_date = startDate; params.end_date = endDate; }
      else params.date_range_type = datePreset;
      return supermetricsQuery("data_query", params).then((data) => ({ site, data }));
    })
  );

  return results.map((result, i) => ({
    site:    sites[i],
    metrics: result.status === "fulfilled" ? result.value.data : null,
    error:   result.status === "rejected"  ? result.reason?.message : null,
  }));
}

// ── Relatório Consolidado ─────────────────────────────────────

async function getFullReport({ datePreset = "last_30_days" } = {}) {
  const [googleAds, ga4, searchConsole, accounts] = await Promise.allSettled([
    getGoogleAdsDashboard({ datePreset }),
    getAllGA4Metrics({ datePreset }),
    getSearchConsoleMetrics({ datePreset }),
    discovery.discoverAllAccounts(),
  ]);

  return {
    period: datePreset,
    generatedAt: new Date().toISOString(),
    accountsSummary: accounts.status === "fulfilled"
      ? { googleAds: accounts.value.googleAds.length, ga4: accounts.value.ga4.length, searchConsole: accounts.value.searchConsole.length }
      : null,
    googleAds:     googleAds.status     === "fulfilled" ? googleAds.value     : { error: googleAds.reason?.message },
    ga4:           ga4.status           === "fulfilled" ? ga4.value           : { error: ga4.reason?.message },
    searchConsole: searchConsole.status === "fulfilled" ? searchConsole.value : { error: searchConsole.reason?.message },
  };
}

module.exports = {
  getGoogleAdsDashboard, getGoogleAdsMetrics, compareGoogleAdsAccounts,
  getAllGA4Metrics, getGA4Metrics,
  getSearchConsoleMetrics,
  getFullReport,
  discovery,
};
