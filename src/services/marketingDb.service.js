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

const GOOGLE_ADS_TABLE   = "googleads_custom_report_banco_de_dados";
const FACEBOOK_ADS_TABLE = "facebook_campaign_insights";

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

async function discoverFacebookAdsAccounts() {
  if (!(await db.tableExists(FACEBOOK_ADS_TABLE))) return [];

  const { rows } = await db.query(`
    SELECT DISTINCT account_id AS id, account_name AS name
    FROM ${FACEBOOK_ADS_TABLE}
    WHERE account_name IS NOT NULL
    ORDER BY name
  `);
  return rows.map((r) => ({ id: r.id, name: r.name, platform: "facebook_ads" }));
}

async function discoverGA4Accounts() {
  if (!(await db.tableExists(GA4_TABLE))) return [];
  return [{ ...GA4_PROPERTY, platform: "ga4" }];
}

async function discoverSearchConsoleAccounts() {
  return []; // Search Console ainda não configurado no Kondado
}

async function discoverAllAccounts() {
  const [googleAds, facebookAds, ga4, searchConsole] = await Promise.allSettled([
    discoverGoogleAdsAccounts(),
    discoverFacebookAdsAccounts(),
    discoverGA4Accounts(),
    discoverSearchConsoleAccounts(),
  ]);

  return {
    googleAds:     googleAds.status     === "fulfilled" ? googleAds.value     : [],
    facebookAds:   facebookAds.status   === "fulfilled" ? facebookAds.value   : [],
    ga4:           ga4.status           === "fulfilled" ? ga4.value           : [],
    searchConsole: searchConsole.status === "fulfilled" ? searchConsole.value : [],
    errors: {
      googleAds:     googleAds.status     === "rejected" ? googleAds.reason?.message     : null,
      facebookAds:   facebookAds.status   === "rejected" ? facebookAds.reason?.message   : null,
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
  discoverFacebookAdsAccounts,
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

// ── Facebook Ads (replicado pelo Kondado, granularidade mensal) ──

async function getFacebookAdsDashboard(options = {}) {
  if (!(await db.tableExists(FACEBOOK_ADS_TABLE))) {
    return { error: "Facebook Ads ainda não sincronizado — tabela não encontrada no Postgres." };
  }
  const { since, until } = resolveDateRange(options);

  const { rows } = await db.query(
    `
    SELECT
      account_id, account_name AS name,
      SUM(impressions) AS impressions,
      SUM(clicks)       AS clicks,
      SUM(spend)        AS cost,
      SUM(reach)         AS reach,
      SUM(a_lead)         AS leads
    FROM ${FACEBOOK_ADS_TABLE}
    WHERE metric_date BETWEEN $1 AND $2
    GROUP BY account_id, account_name
    ORDER BY cost DESC
    `,
    [since, until]
  );

  return rows.map((r) => ({
    account: { id: r.account_id, name: r.name },
    metrics: {
      impressions: Number(r.impressions) || 0,
      clicks:      Number(r.clicks)      || 0,
      cost:        Number(r.cost)        || 0,
      reach:       Number(r.reach)       || 0,
      leads:       Number(r.leads)       || 0,
      ctr: Number(r.impressions) > 0 ? (Number(r.clicks) / Number(r.impressions)) * 100 : 0,
      cpc: Number(r.clicks)      > 0 ? Number(r.cost) / Number(r.clicks)                : 0,
      cpm: Number(r.impressions) > 0 ? (Number(r.cost) * 1000) / Number(r.impressions)  : 0,
    },
  }));
}

async function getFacebookAdsMetrics(query, options = {}) {
  if (!(await db.tableExists(FACEBOOK_ADS_TABLE))) {
    throw new Error("Facebook Ads ainda não sincronizado — tabela não encontrada no Postgres.");
  }
  const { since, until } = resolveDateRange(options);

  const { rows: accountRows } = await db.query(
    `SELECT DISTINCT account_id, account_name
     FROM ${FACEBOOK_ADS_TABLE}
     WHERE account_id = $1 OR account_name ILIKE $2
     LIMIT 1`,
    [String(query), `%${query}%`]
  );
  const account = accountRows[0];
  if (!account) throw new Error(`Conta Facebook Ads não encontrada: "${query}"`);

  const { rows } = await db.query(
    `
    SELECT campaign_id, campaign_name, metric_date,
      SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(spend) AS cost, SUM(a_lead) AS leads
    FROM ${FACEBOOK_ADS_TABLE}
    WHERE account_id = $1 AND metric_date BETWEEN $2 AND $3
    GROUP BY campaign_id, campaign_name, metric_date
    ORDER BY metric_date DESC, cost DESC
    `,
    [account.account_id, since, until]
  );

  return {
    account: { id: account.account_id, name: account.account_name },
    data: rows.map((r) => ({
      campaignId:   r.campaign_id,
      campaignName: r.campaign_name,
      date:         r.metric_date,
      impressions:  Number(r.impressions) || 0,
      clicks:       Number(r.clicks) || 0,
      cost:         Number(r.cost) || 0,
      leads:        Number(r.leads) || 0,
    })),
  };
}

async function compareFacebookAdsAccounts({ datePreset = "last_30_days", metric = "cost" } = {}) {
  const dashboard = await getFacebookAdsDashboard({ datePreset });
  if (dashboard.error) return dashboard;

  return dashboard
    .map((d) => ({ id: d.account.id, name: d.account.name, ...d.metrics }))
    .sort((a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0));
}

// ── GA4 (replicado pelo Kondado — uma propriedade só, "LP Agendamento / Óticas TGT Site Multi Lojas") ──

const GA4_TABLE = "ga4_custom_report";
const GA4_PROPERTY = { id: "541104090", name: "LP Agendamento (Óticas TGT Site Multi Lojas)" };

async function getAllGA4Metrics(options = {}) {
  if (!(await db.tableExists(GA4_TABLE))) return [];
  const { since, until } = resolveDateRange(options);

  const { rows } = await db.query(
    `
    SELECT
      sessionsourcemedium AS source_medium,
      SUM(sessions)         AS sessions,
      SUM(activeusers)      AS active_users,
      SUM(screenpageviews)  AS views,
      AVG(engagementrate)   AS engagement_rate
    FROM ${GA4_TABLE}
    WHERE date BETWEEN $1 AND $2
    GROUP BY sessionsourcemedium
    ORDER BY sessions DESC
    `,
    [since, until]
  );

  return rows.map((r) => ({
    sourceMedium:   r.source_medium,
    sessions:       Number(r.sessions)       || 0,
    activeUsers:    Number(r.active_users)   || 0,
    views:          Number(r.views)          || 0,
    engagementRate: Number(r.engagement_rate) || 0,
  }));
}

async function getGA4Metrics(query, options = {}) {
  if (!(await db.tableExists(GA4_TABLE))) {
    throw new Error("GA4 ainda não sincronizado — tabela não encontrada no Postgres.");
  }
  const { since, until } = resolveDateRange(options);

  const { rows } = await db.query(
    `
    SELECT date, sessionsourcemedium AS source_medium, sessions, activeusers, screenpageviews, engagementrate
    FROM ${GA4_TABLE}
    WHERE date BETWEEN $1 AND $2
    ORDER BY date DESC, sessions DESC
    `,
    [since, until]
  );

  return {
    property: GA4_PROPERTY,
    data: rows.map((r) => ({
      date:           r.date,
      sourceMedium:   r.source_medium,
      sessions:       Number(r.sessions)        || 0,
      activeUsers:    Number(r.activeusers)     || 0,
      views:          Number(r.screenpageviews) || 0,
      engagementRate: Number(r.engagementrate)  || 0,
    })),
  };
}

async function getSearchConsoleMetrics() {
  return []; // Search Console ainda não configurado no Kondado
}

// ── Relatório consolidado ──────────────────────────────────────

async function getFullReport(options = {}) {
  const [googleAds, facebookAds, ga4, searchConsole, accounts] = await Promise.allSettled([
    getGoogleAdsDashboard(options),
    getFacebookAdsDashboard(options),
    getAllGA4Metrics(options),
    getSearchConsoleMetrics(),
    discoverAllAccounts(),
  ]);

  return {
    period: options.datePreset || "last_30_days",
    generatedAt: new Date().toISOString(),
    accountsSummary: accounts.status === "fulfilled"
      ? { googleAds: accounts.value.googleAds.length, facebookAds: accounts.value.facebookAds.length, ga4: accounts.value.ga4.length, searchConsole: accounts.value.searchConsole.length }
      : null,
    googleAds:     googleAds.status     === "fulfilled" ? googleAds.value     : { error: googleAds.reason?.message },
    facebookAds:   facebookAds.status   === "fulfilled" ? facebookAds.value   : { error: facebookAds.reason?.message },
    ga4:           ga4.status           === "fulfilled" ? ga4.value           : { error: ga4.reason?.message },
    searchConsole: searchConsole.status === "fulfilled" ? searchConsole.value : { error: searchConsole.reason?.message },
  };
}

module.exports = {
  getGoogleAdsDashboard, getGoogleAdsMetrics, compareGoogleAdsAccounts,
  getFacebookAdsDashboard, getFacebookAdsMetrics, compareFacebookAdsAccounts,
  getAllGA4Metrics, getGA4Metrics,
  getSearchConsoleMetrics,
  getFullReport,
  discovery,
};
