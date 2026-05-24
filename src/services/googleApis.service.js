/**
 * AdAnalyzer — googleApis.service.js
 * GA4, Search Console e Tag Manager com auto-descoberta de contas.
 */

const { google } = require("googleapis");
const { getAuthenticatedClient } = require("../routes/googleOAuth");

// Cache de contas descobertas (5 minutos)
const CACHE_TTL = 5 * 60 * 1000;
let _cache = { ga4: null, searchConsole: null, ts: 0 };

function isCacheValid() {
  return Date.now() - _cache.ts < CACHE_TTL;
}

// ── Auto-descoberta ───────────────────────────────────────────

async function discoverGA4Properties(forceRefresh = false) {
  if (!forceRefresh && isCacheValid() && _cache.ga4) return _cache.ga4;

  const auth = getAuthenticatedClient();
  const adminApi = google.analyticsadmin({ version: "v1beta", auth });

  const response = await adminApi.properties.list({
    filter: "parent:accounts/-",
    pageSize: 200,
  });

  const properties = (response.data.properties || []).map((p) => ({
    propertyId: p.name.replace("properties/", ""),
    displayName: p.displayName,
    createTime: p.createTime,
  }));

  _cache.ga4 = properties;
  _cache.ts  = Date.now();

  console.log(`[GA4 Discovery] ${properties.length} propriedades encontradas`);
  return properties;
}

async function discoverSearchConsoleSites(forceRefresh = false) {
  if (!forceRefresh && isCacheValid() && _cache.searchConsole) return _cache.searchConsole;

  const auth = getAuthenticatedClient();
  const sc = google.searchconsole({ version: "v1", auth });

  const response = await sc.sites.list();
  const sites = (response.data.siteEntry || []).map((s) => ({
    siteUrl:        s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));

  _cache.searchConsole = sites;
  _cache.ts = Date.now();

  console.log(`[Search Console Discovery] ${sites.length} sites encontrados`);
  return sites;
}

async function refreshDiscovery() {
  _cache = { ga4: null, searchConsole: null, ts: 0 };
  const [ga4, sc] = await Promise.allSettled([
    discoverGA4Properties(true),
    discoverSearchConsoleSites(true),
  ]);
  return {
    ga4:           ga4.status === "fulfilled" ? ga4.value : { error: ga4.reason?.message },
    searchConsole: sc.status  === "fulfilled" ? sc.value  : { error: sc.reason?.message },
  };
}

// ── Google Analytics 4 ────────────────────────────────────────

async function getGA4Report({ propertyId, dateRange = "last_30_days", metrics, dimensions }) {
  const auth = getAuthenticatedClient();
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });
  const [startDate, endDate] = resolveDateRange(dateRange);

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics:    (metrics    || ["sessions", "activeUsers", "newUsers", "bounceRate", "conversions"]).map((m) => ({ name: m })),
      dimensions: (dimensions || ["date"]).map((d) => ({ name: d })),
    },
  });

  return response.data;
}

async function getAllGA4Reports(dateRange = "last_30_days") {
  // Tenta auto-descoberta; cai para env var se falhar
  let properties;
  try {
    properties = await discoverGA4Properties();
  } catch (e) {
    console.warn("[GA4] Auto-descoberta falhou, usando GA4_PROPERTY_IDS:", e.message);
    const ids = (process.env.GA4_PROPERTY_IDS || "").split(",").filter(Boolean);
    properties = ids.map((id) => ({ propertyId: id.trim(), displayName: id.trim() }));
  }

  if (properties.length === 0) {
    return { error: "Nenhuma propriedade GA4 encontrada" };
  }

  const results = await Promise.allSettled(
    properties.map((p) => getGA4Report({ propertyId: p.propertyId, dateRange }))
  );

  return properties.map((p, i) => ({
    propertyId:  p.propertyId,
    displayName: p.displayName,
    data:  results[i].status === "fulfilled" ? results[i].value : null,
    error: results[i].status === "rejected"  ? results[i].reason?.message : null,
  }));
}

// ── Google Search Console ─────────────────────────────────────

async function getSearchConsoleData({ siteUrl, dateRange = "last_30_days", dimensions = ["query"], rowLimit = 25 }) {
  const auth = getAuthenticatedClient();
  const sc = google.searchconsole({ version: "v1", auth });
  const [startDate, endDate] = resolveDateRange(dateRange);

  const response = await sc.searchanalytics.query({
    siteUrl,
    requestBody: { startDate, endDate, dimensions, rowLimit },
  });

  return response.data;
}

async function getAllSearchConsoleData(dateRange = "last_30_days") {
  // Tenta auto-descoberta; cai para env var se falhar
  let sites;
  try {
    const discovered = await discoverSearchConsoleSites();
    sites = discovered.map((s) => s.siteUrl);
  } catch (e) {
    console.warn("[Search Console] Auto-descoberta falhou, usando env:", e.message);
    sites = (process.env.SEARCH_CONSOLE_SITES || "").split(",").filter(Boolean).map((s) => s.trim());
  }

  if (sites.length === 0) {
    return { error: "Nenhum site Search Console encontrado" };
  }

  const results = await Promise.allSettled(
    sites.map((site) => getSearchConsoleData({ siteUrl: site, dateRange }))
  );

  return sites.map((site, i) => ({
    site,
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
    period:       dateRange,
    generatedAt:  new Date().toISOString(),
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
  discoverGA4Properties, discoverSearchConsoleSites, refreshDiscovery,
};
