/**
 * AdAnalyzer — marketingDb.service.js
 * Substitui o Supermetrics (accounts.discovery.js + supermetrics.service.js),
 * que chamava o endpoint MCP da Supermetrics como se fosse um REST simples e
 * nunca funcionou. Google Ads e Meta Ads agora são replicados pelo Kondado
 * direto num Postgres do Railway; este serviço só faz SELECT nele.
 *
 * GA4 e Search Console ainda não têm integração configurada no Kondado —
 * as funções abaixo respondem de forma graciosa ("não configurado") em vez
 * de quebrar, até essas duas serem adicionadas.
 */

const db = require("./db");

const GOOGLE_ADS_TABLE = "googleads_custom_report_banco_de_dados";

// ── Datas ─────────────────────────────────────────────────────

function resolveDateRange({ datePreset = "last_30_days", startDate, endDate } = {}) {
  if (startDate && endDate) return { since: startDate, until: endDate };

  const fmt = (d) => d.toISOString().split("T")[0];
  const today = new Date();

  const presets = {
    last_7_days:  () => { const s = new Date(today); s.setDate(today.getDate() - 7);  return [fmt(s), fmt(today)]; },
    last_30_days: () => { const s = new Date(today); s.setDate(today.getDate() - 30); return [fmt(s), fmt(today)]; },
    last_90_days: () => { const s = new Date(today); s.setDate(today.getDate() - 90); return [fmt(s), fmt(today)]; },
    this_month:   () => { const s = new Date(today.getFullYear(), today.getMonth(), 1); return [fmt(s), fmt(today)]; },
    last_month:   () => {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return [fmt(s), fmt(e)];
    },
  };

  const [since, until] = (presets[datePreset] || presets.last_30_days)();
  return { since, until };
}

// ── Descoberta de contas Google Ads (real, a partir do que o Kondado já sincronizou) ──

async function discoverGoogleAdsAccounts() {
  if (!(await db.tableExists(GOOGLE_ADS_TABLE))) return [];

  const { rows } = await db.query(`
    SELECT DISTINCT customer_id AS id, customer_descriptivename AS name
    FROM ${GOOGLE_ADS_TABLE}
    WHERE customer_descriptivename IS NOT NULL
    ORDER BY name
  `);
  return rows.map((r) => ({ id: r.id, name: r.name, platform: "google_ads" }));
}

async function discoverGA4Accounts() {
  return []; // GA4 ainda não configurado no Kondado
}

async function discoverSearchConsoleAccounts() {
  return []; // Search Console ainda não configurado no Kondado
}

async function discoverAllAccounts() {
  const [googleAds, ga4, searchConsole] = await Promise.allSettled([
    discoverGoogleAdsAccounts(),
    discoverGA4Accounts(),
    discoverSearchConsoleAccounts(),
  ]);

  return {
    googleAds:     googleAds.status     === "fulfilled" ? googleAds.value     : [],
    ga4:           ga4.status           === "fulfilled" ? ga4.value           : [],
    searchConsole: searchConsole.status === "fulfilled" ? searchConsole.value : [],
    errors: {
      googleAds:     googleAds.status     === "rejected" ? googleAds.reason?.message     : null,
      ga4:           null,
      searchConsole: null,
    },
    refreshedAt: new Date().toISOString(),
  };
}

async function refreshAllAccounts() {
  // Sem cache em memória — cada consulta já é um SELECT direto no Postgres.
  return discoverAllAccounts();
}

const discovery = {
  discoverGoogleAdsAccounts,
  discoverGA4Accounts,
  discoverSearchConsoleAccounts,
  discoverAllAccounts,
  refreshAllAccounts,
  cache: { status: () => ({ note: "sem cache — consulta direta ao Postgres a cada chamada" }) },
};

// ── Google Ads ────────────────────────────────────────────────

async function getGoogleAdsDashboard(options = {}) {
  if (!(await db.tableExists(GOOGLE_ADS_TABLE))) {
    return { error: "Google Ads ainda não sincronizado — tabela não encontrada no Postgres." };
  }
  const { since, until } = resolveDateRange(options);

  const { rows } = await db.query(
    `
    SELECT
      customer_id, customer_descriptivename AS name,
      SUM(metrics_impressions)      AS impressions,
      SUM(metrics_clicks)           AS clicks,
      SUM(metrics_cost)             AS cost,
      SUM(metrics_conversions)      AS conversions,
      SUM(metrics_conversionsvalue) AS conversions_value
    FROM ${GOOGLE_ADS_TABLE}
    WHERE segments_date BETWEEN $1 AND $2
    GROUP BY customer_id, customer_descriptivename
    ORDER BY cost DESC
    `,
    [since, until]
  );

  return rows.map((r) => ({
    account: { id: r.customer_id, name: r.name },
    metrics: {
      impressions:       Number(r.impressions)       || 0,
      clicks:             Number(r.clicks)            || 0,
      cost:                Number(r.cost)              || 0,
      conversions:         Number(r.conversions)        || 0,
      conversions_value:   Number(r.conversions_value)  || 0,
      ctr:  Number(r.impressions) > 0 ? (Number(r.clicks) / Number(r.impressions)) * 100 : 0,
      cpc:  Number(r.clicks)      > 0 ? Number(r.cost) / Number(r.clicks)                : 0,
      roas: Number(r.cost)        > 0 ? Number(r.conversions_value) / Number(r.cost)      : 0,
    },
  }));
}

async function getGoogleAdsMetrics(query, options = {}) {
  if (!(await db.tableExists(GOOGLE_ADS_TABLE))) {
    throw new Error("Google Ads ainda não sincronizado — tabela não encontrada no Postgres.");
  }
  const { since, until } = resolveDateRange(options);

  const { rows: accountRows } = await db.query(
    `SELECT DISTINCT customer_id, customer_descriptivename
     FROM ${GOOGLE_ADS_TABLE}
     WHERE customer_id = $1 OR customer_descriptivename ILIKE $2
     LIMIT 1`,
    [String(query), `%${query}%`]
  );
  const account = accountRows[0];
  if (!account) throw new Error(`Conta Google Ads não encontrada: "${query}"`);

  const { rows } = await db.query(
    `
    SELECT campaign_id, campaign_name, segments_date,
      metrics_impressions, metrics_clicks, metrics_cost, metrics_conversions, metrics_conversionsvalue
    FROM ${GOOGLE_ADS_TABLE}
    WHERE customer_id = $1 AND segments_date BETWEEN $2 AND $3
    ORDER BY segments_date DESC, metrics_cost DESC
    `,
    [account.customer_id, since, until]
  );

  return {
    account: { id: account.customer_id, name: account.customer_descriptivename },
    data: rows.map((r) => ({
      campaignId:   r.campaign_id,
      campaignName: r.campaign_name,
      date:         r.segments_date,
      impressions:  Number(r.metrics_impressions) || 0,
      clicks:       Number(r.metrics_clicks) || 0,
      cost:         Number(r.metrics_cost) || 0,
      conversions:  Number(r.metrics_conversions) || 0,
      conversionsValue: Number(r.metrics_conversionsvalue) || 0,
    })),
  };
}

async function compareGoogleAdsAccounts({ datePreset = "last_30_days", metric = "cost" } = {}) {
  const dashboard = await getGoogleAdsDashboard({ datePreset });
  if (dashboard.error) return dashboard;

  return dashboard
    .map((d) => ({ id: d.account.id, name: d.account.name, ...d.metrics }))
    .sort((a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0));
}

// ── GA4 / Search Console (ainda não configurados no Kondado) ──

async function getAllGA4Metrics() {
  return [];
}

async function getGA4Metrics(query) {
  throw new Error(`GA4 ainda não configurado no Kondado — não é possível buscar "${query}".`);
}

async function getSearchConsoleMetrics() {
  return [];
}

// ── Relatório consolidado ──────────────────────────────────────

async function getFullReport(options = {}) {
  const [googleAds, ga4, searchConsole, accounts] = await Promise.allSettled([
    getGoogleAdsDashboard(options),
    getAllGA4Metrics(),
    getSearchConsoleMetrics(),
    discoverAllAccounts(),
  ]);

  return {
    period: options.datePreset || "last_30_days",
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
