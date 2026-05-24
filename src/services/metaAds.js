/**
 * AdAnalyzer — Meta Ads Service
 * Integração completa com a Meta Graph API
 */

const BASE_URL = "https://graph.facebook.com";

function getConfig() {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const version = process.env.META_API_VERSION || "v19.0";

  if (!token) throw new Error("META_ACCESS_TOKEN não configurado");
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID não configurado");

  return { token, accountId, version };
}

async function graphRequest(endpoint, params = {}) {
  const { token, version } = getConfig();

  const url = new URL(`${BASE_URL}/${version}/${endpoint}`);
  url.searchParams.set("access_token", token);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    const err = data.error;
    throw new Error(`Meta API Error [${err.code}] ${err.type}: ${err.message}`);
  }

  return data;
}

const INSIGHT_FIELDS = [
  "campaign_name", "campaign_id", "adset_name", "adset_id",
  "ad_name", "ad_id", "impressions", "clicks", "spend", "reach",
  "frequency", "ctr", "cpc", "cpm", "cpp", "actions",
  "cost_per_action_type", "date_start", "date_stop",
].join(",");

async function getCampaigns({ status = "ALL" } = {}) {
  const { accountId } = getConfig();
  const filtering = status !== "ALL"
    ? JSON.stringify([{ field: "effective_status", operator: "IN", value: [status] }])
    : undefined;

  const data = await graphRequest(`${accountId}/campaigns`, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time",
    filtering,
    limit: 100,
  });
  return data.data || [];
}

async function getCampaignInsights(campaignId, dateRange = {}) {
  const { since, until } = buildDateRange(dateRange);
  const data = await graphRequest(`${campaignId}/insights`, {
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
    level: "campaign",
    limit: 100,
  });
  return data.data || [];
}

async function getAdSets({ campaignId, status = "ALL" } = {}) {
  const { accountId } = getConfig();
  const endpoint = campaignId ? `${campaignId}/adsets` : `${accountId}/adsets`;
  const filtering = status !== "ALL"
    ? JSON.stringify([{ field: "effective_status", operator: "IN", value: [status] }])
    : undefined;

  const data = await graphRequest(endpoint, {
    fields: "id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,bid_amount,start_time,end_time",
    filtering,
    limit: 100,
  });
  return data.data || [];
}

async function getAdSetInsights(adSetId, dateRange = {}) {
  const { since, until } = buildDateRange(dateRange);
  const data = await graphRequest(`${adSetId}/insights`, {
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
    level: "adset",
    limit: 100,
  });
  return data.data || [];
}

async function getAds({ campaignId, adSetId, status = "ALL" } = {}) {
  const { accountId } = getConfig();
  let endpoint;
  if (adSetId) endpoint = `${adSetId}/ads`;
  else if (campaignId) endpoint = `${campaignId}/ads`;
  else endpoint = `${accountId}/ads`;

  const filtering = status !== "ALL"
    ? JSON.stringify([{ field: "effective_status", operator: "IN", value: [status] }])
    : undefined;

  const data = await graphRequest(endpoint, {
    fields: "id,name,status,campaign_id,adset_id,creative{id,name,thumbnail_url,object_story_spec},created_time,updated_time",
    filtering,
    limit: 100,
  });
  return data.data || [];
}

async function getAdInsights(adId, dateRange = {}) {
  const { since, until } = buildDateRange(dateRange);
  const data = await graphRequest(`${adId}/insights`, {
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
    level: "ad",
    limit: 100,
  });
  return data.data || [];
}

async function getInsights({ dateRange = {}, datePreset, level = "campaign", breakdowns = [], timeIncrement } = {}) {
  const { accountId } = getConfig();
  const params = { fields: INSIGHT_FIELDS, level, limit: 500 };

  if (datePreset) {
    params.date_preset = datePreset;
  } else {
    const { since, until } = buildDateRange(dateRange);
    params.time_range = JSON.stringify({ since, until });
  }

  if (breakdowns.length > 0) params.breakdowns = breakdowns.join(",");
  if (timeIncrement) params.time_increment = timeIncrement;

  const data = await graphRequest(`${accountId}/insights`, params);
  return data.data || [];
}

async function getDashboardSummary() {
  const [current, previous, campaigns] = await Promise.all([
    getInsights({ datePreset: "last_30d", level: "account" }),
    getInsights({ datePreset: "last_30d", level: "campaign" }),
    getCampaigns({ status: "ACTIVE" }),
  ]);

  return {
    period: "last_30d",
    account: current[0] || null,
    campaigns: previous,
    activeCampaigns: campaigns.length,
    generatedAt: new Date().toISOString(),
  };
}

async function validateToken() {
  const { token, accountId } = getConfig();

  const [meData, debugData] = await Promise.all([
    graphRequest("me", { fields: "id,name,email" }),
    graphRequest("debug_token", {
      input_token: token,
      access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
    }).catch(() => null),
  ]);

  return { valid: true, user: meData, tokenInfo: debugData?.data || null, accountId };
}

function buildDateRange({ since, until } = {}) {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  return {
    since: since || thirtyDaysAgo.toISOString().split("T")[0],
    until: until || today.toISOString().split("T")[0],
  };
}

module.exports = {
  getCampaigns, getCampaignInsights,
  getAdSets, getAdSetInsights,
  getAds, getAdInsights,
  getInsights, getDashboardSummary,
  validateToken,
};
