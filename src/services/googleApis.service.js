/**
 * AdAnalyzer — googleApis.service.js
 * Integração com Google Ads, GA4, Search Console e Tag Manager
 * usando googleapis oficial.
 */

const { google }             = require("googleapis");
const { getAuthenticatedClient } = require("../routes/googleOAuth");

// ── Google Analytics 4 ────────────────────────────────────────

async function getGA4Report({ propertyId, dateRange = "last_30_days", metrics, dimensions }) {
  const auth = getAuthenticatedClient();

  const analyticsData = google.analyticsdata({ version: "v1beta", auth });

  const [startDate, endDate] = resolveDateRange(dateRange);

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: (metrics || ["sessions", "activeUsers", "newUsers", "bounceRate", "conversions"]).map((m) => ({ name: m })),
      dimensions: (dimensions || ["date"]).map((d) => ({ name: d })),
    },
  });

  return response.data;
}

async function getAllGA4Reports(dateRange = "last_30_days") {
  const propertyIds = (process.env.GA4_PROPERTY_IDS || "").split(",").filter(Boolean);

  if (propertyIds.length === 0) {
    return { error: "GA4_PROPERTY_IDS não configurado no Railway" };
  }

  const results = await Promise.allSettled(
    propertyIds.map((id) => getGA4Report({ propertyId: id.trim(), dateRange }))
  );

  return propertyIds.map((id, i) => ({
    propertyId: id.trim(),
    data:  results[i].status === "fulfilled" ? results[i].value : null,
    error: results[i].status === "rejected"  ? results[i].reason?.message : null,
  }));
}

// ── Google Search Console ─────────────────────────────────────

async function getSearchConsoleData({ siteUrl, dateRange = "last_30_days", dimensions = ["query"], rowLimit = 25 }) {
  const auth = getAuthenticatedClient();
  const searchConsole = google.searchconsole({ version: "v1", auth });

  const [startDate, endDate] = resolveDateRange(dateRange);

  const response = await searchConsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions,
      rowLimit,
    },
  });

  return response.data;
}

async function getAllSearchConsoleData(dateRange = "last_30_days") {
  const sites = (process.env.SEARCH_CONSOLE_SITES || "https://oticastgt.com.br/").split(",").filter(Boolean);

  const results = await Promise.allSettled(
    sites.map((site) => getSearchConsoleData({ siteUrl: site.trim(), dateRange }))
  );

  return sites.map((site, i) => ({
    site: site.trim(),
    data:  results[i].status === "fulfilled" ? results[i].value : null,
    error: results[i].status === "rejected"  ? results[i].reason?.message : null,
  }));
}

// ── Google Tag Manager ────────────────────────────────────────

async function getGTMAccounts() {
  const auth = getAuthenticatedClient();
  const tagManager = google.tagmanager({ version: "v2", auth });

  const response = await tagManager.accounts.list();
  return response.data.account || [];
}

async function getGTMContainers(accountId) {
  const auth = getAuthenticatedClient();
  const tagManager = google.tagmanager({ version: "v2", auth });

  const response = await tagManager.accounts.containers.list({
    parent: `accounts/${accountId}`,
  });

  return response.data.container || [];
}

// ── Relatório Consolidado ─────────────────────────────────────

async function getFullGoogleReport(dateRange = "last_30_days") {
  const [ga4, searchConsole] = await Promise.allSettled([
    getAllGA4Reports(dateRange),
    getAllSearchConsoleData(dateRange),
  ]);

  return {
    period: dateRange,
    generatedAt: new Date().toISOString(),
    ga4:           ga4.status           === "fulfilled" ? ga4.value           : { error: ga4.reason?.message },
    searchConsole: searchConsole.status === "fulfilled" ? searchConsole.value : { error: searchConsole.reason?.message },
  };
}

// ── Utilitário ────────────────────────────────────────────────

function resolveDateRange(preset) {
  const today = new Date();
  const fmt   = (d) => d.toISOString().split("T")[0];

  const presets = {
    "last_7_days":  () => { const s = new Date(today); s.setDate(today.getDate() - 7);  return [fmt(s), fmt(today)]; },
    "last_30_days": () => { const s = new Date(today); s.setDate(today.getDate() - 30); return [fmt(s), fmt(today)]; },
    "last_90_days": () => { const s = new Date(today); s.setDate(today.getDate() - 90); return [fmt(s), fmt(today)]; },
    "this_month":   () => { const s = new Date(today.getFullYear(), today.getMonth(), 1); return [fmt(s), fmt(today)]; },
    "last_month":   () => {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return [fmt(s), fmt(e)];
    },
  };

  return (presets[preset] || presets["last_30_days"])();
}

module.exports = {
  getGA4Report, getAllGA4Reports,
  getSearchConsoleData, getAllSearchConsoleData,
  getGTMAccounts, getGTMContainers,
  getFullGoogleReport,
};
