/**
 * AdAnalyzer — accounts.discovery.js
 * Descoberta automática de contas via Supermetrics.
 * Cache de 5 minutos (configurável via ACCOUNTS_CACHE_TTL_MS).
 */

const SUPERMETRICS_MCP_URL = process.env.SUPERMETRICS_MCP_URL || "https://mcp.supermetrics.com/mcp";
const CACHE_TTL_MS = Number(process.env.ACCOUNTS_CACHE_TTL_MS) || 5 * 60 * 1000;

// ── Cache em memória ──────────────────────────────────────────

const cache = {
  data: {},
  timestamps: {},

  set(key, value) { this.data[key] = value; this.timestamps[key] = Date.now(); },

  get(key) {
    const ts = this.timestamps[key];
    if (!ts || Date.now() - ts > CACHE_TTL_MS) return null;
    return this.data[key];
  },

  invalidate(key) { delete this.data[key]; delete this.timestamps[key]; },

  invalidateAll() { this.data = {}; this.timestamps = {}; },

  status() {
    return Object.keys(this.data).reduce((acc, key) => {
      const age = Math.round((Date.now() - this.timestamps[key]) / 1000);
      const ttl = Math.round((CACHE_TTL_MS - (Date.now() - this.timestamps[key])) / 1000);
      acc[key] = { cached: true, ageSeconds: age, expiresInSeconds: ttl > 0 ? ttl : 0 };
      return acc;
    }, {});
  },
};

// ── Helper ────────────────────────────────────────────────────

async function supermetricsRequest(tool, params = {}) {
  const response = await fetch(`${SUPERMETRICS_MCP_URL}/tools/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, compress: true }),
  });

  if (!response.ok) throw new Error(`Supermetrics HTTP ${response.status}: ${response.statusText}`);

  const data = await response.json();
  if (!data.success && data.error) throw new Error(`Supermetrics [${tool}]: ${data.error}`);
  return data;
}

// ── Descoberta ────────────────────────────────────────────────

async function discoverGoogleAdsAccounts(forceRefresh = false) {
  const cacheKey = "google_ads_accounts";
  if (!forceRefresh) { const cached = cache.get(cacheKey); if (cached) return cached; }

  const data = await supermetricsRequest("accounts_discovery", { ds_id: "AW" });
  const accounts = (data.data || []).map((acc) => ({
    id: acc.account_id, name: acc.account_name,
    group: acc.group_name || null, isMCC: !!acc.group_name, platform: "google_ads",
  }));

  cache.set(cacheKey, accounts);
  console.log(`[AccountDiscovery] Google Ads: ${accounts.length} contas`);
  return accounts;
}

async function discoverGA4Accounts(forceRefresh = false) {
  const cacheKey = "ga4_accounts";
  if (!forceRefresh) { const cached = cache.get(cacheKey); if (cached) return cached; }

  const data = await supermetricsRequest("accounts_discovery", { ds_id: "GAWA" });
  const accounts = (data.data || []).map((acc) => ({
    id: acc.account_id, name: acc.account_name, group: acc.group_name || null, platform: "ga4",
  }));

  cache.set(cacheKey, accounts);
  console.log(`[AccountDiscovery] GA4: ${accounts.length} propriedades`);
  return accounts;
}

async function discoverSearchConsoleAccounts(forceRefresh = false) {
  const cacheKey = "search_console_accounts";
  if (!forceRefresh) { const cached = cache.get(cacheKey); if (cached) return cached; }

  const data = await supermetricsRequest("accounts_discovery", { ds_id: "GW" });
  const accounts = (data.data || []).map((acc) => ({
    id: acc.account_id, name: acc.account_name, platform: "search_console",
  }));

  cache.set(cacheKey, accounts);
  console.log(`[AccountDiscovery] Search Console: ${accounts.length} sites`);
  return accounts;
}

async function discoverAllAccounts(forceRefresh = false) {
  const [googleAds, ga4, searchConsole] = await Promise.allSettled([
    discoverGoogleAdsAccounts(forceRefresh),
    discoverGA4Accounts(forceRefresh),
    discoverSearchConsoleAccounts(forceRefresh),
  ]);

  return {
    googleAds:     googleAds.status     === "fulfilled" ? googleAds.value     : [],
    ga4:           ga4.status           === "fulfilled" ? ga4.value           : [],
    searchConsole: searchConsole.status === "fulfilled" ? searchConsole.value : [],
    errors: {
      googleAds:     googleAds.status     === "rejected" ? googleAds.reason?.message     : null,
      ga4:           ga4.status           === "rejected" ? ga4.reason?.message           : null,
      searchConsole: searchConsole.status === "rejected" ? searchConsole.reason?.message : null,
    },
    refreshedAt: new Date().toISOString(),
    cacheStatus: cache.status(),
  };
}

async function refreshAllAccounts() {
  cache.invalidateAll();
  console.log("[AccountDiscovery] Cache limpo — recarregando...");
  return discoverAllAccounts(true);
}

async function findGoogleAdsAccount(query) {
  const accounts = await discoverGoogleAdsAccounts();
  const q = String(query).toLowerCase();
  return accounts.find((a) => a.id === query || a.name.toLowerCase().includes(q)) || null;
}

async function findGA4Account(query) {
  const accounts = await discoverGA4Accounts();
  const q = String(query).toLowerCase();
  return accounts.find((a) => a.id === query || a.name.toLowerCase().includes(q)) || null;
}

async function getAllGoogleAdsIds() {
  const accounts = await discoverGoogleAdsAccounts();
  return accounts.map((a) => a.id);
}

module.exports = {
  discoverGoogleAdsAccounts, discoverGA4Accounts, discoverSearchConsoleAccounts,
  discoverAllAccounts, refreshAllAccounts,
  findGoogleAdsAccount, findGA4Account, getAllGoogleAdsIds,
  cache,
};
