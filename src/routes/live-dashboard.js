/**
 * AdAnalyzer — live-dashboard.js
 * GET /api/live-dashboard?days=N  — Meta + Google Ads em tempo real
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const schedulingSystem = require('../services/schedulingSystem');

const STORES = [
  { id: '9212873095',  name: 'Gonzaga',       color: '#f59e0b' },
  { id: '4121362472',  name: 'Pitangueiras',  color: '#3b82f6' },
  { id: '5679539198',  name: 'Santo Antônio', color: '#10b981' },
  { id: '1420756198',  name: 'Enseada',       color: '#f43f5e' },
];

const MSG_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'new_messaging_connections',
  'onsite_conversion.messaging_first_reply',
];

const liveCache = new Map();
const CACHE_TTL = 60 * 1000;

function getCached(key) {
  const e = liveCache.get(key);
  if (!e || Date.now() - e.ts > CACHE_TTL) { liveCache.delete(key); return null; }
  return e.data;
}
function setCached(key, data) {
  liveCache.set(key, { data, ts: Date.now() });
}

function sumActions(actions, types) {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseInt(a.value || 0), 0);
}

async function refreshGoogleToken() {
  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID     || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth credentials não configurados');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth refresh falhou: ${data.error_description || data.error || JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchGoogleAdsStore(accessToken, customerId, startDate, endDate) {
  const devToken  = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const managerId = process.env.GOOGLE_ADS_MANAGER_ID;

  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN não configurado');

  const query = `
    SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM customer
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  `;

  const headers = {
    'Authorization':   `Bearer ${accessToken}`,
    'developer-token': devToken,
    'Content-Type':    'application/json',
  };
  if (managerId) headers['login-customer-id'] = managerId;

  const res = await fetch(
    `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`,
    { method: 'POST', headers, body: JSON.stringify({ query }) }
  );

  const data = await res.json();
  if (data.error) throw new Error(`Google Ads [${customerId}]: ${data.error.message}`);

  return (data.results || []).reduce((acc, row) => {
    const m = row.metrics || {};
    acc.impressions += parseInt(m.impressions   || 0);
    acc.clicks      += parseInt(m.clicks        || 0);
    acc.spend       += parseInt(m.costMicros || m.cost_micros || 0) / 1_000_000;
    acc.conversions += parseFloat(m.conversions || 0);
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
}

async function fetchMeta(startDate, endDate) {
  const token     = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_ACCOUNT_ID || process.env.META_AD_ACCOUNT_ID;
  const version   = process.env.META_API_VERSION || 'v19.0';

  if (!token || !accountId) throw new Error('META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurados');

  const fields = 'spend,clicks,impressions,actions,campaign_id';
  const url = `https://graph.facebook.com/${version}/${accountId}/insights` +
    `?fields=${fields}` +
    `&time_range={"since":"${startDate}","until":"${endDate}"}` +
    `&level=campaign&limit=500&access_token=${token}`;

  const res  = await fetch(url);
  const data = await res.json();

  if (data.error) throw new Error(`Meta API: ${data.error.message}`);

  const campaigns = data.data || [];
  let spend = 0, clicks = 0, impressions = 0, msgs = 0;

  for (const c of campaigns) {
    spend       += parseFloat(c.spend       || 0);
    clicks      += parseInt(c.clicks        || 0);
    impressions += parseInt(c.impressions   || 0);
    msgs        += sumActions(c.actions, MSG_TYPES);
  }

  return {
    spend,
    clicks,
    impressions,
    msgs,
    cpc:        clicks      > 0 ? spend / clicks           : 0,
    cpm:        impressions > 0 ? (spend * 1000) / impressions : 0,
    costPerMsg: msgs        > 0 ? spend / msgs              : 0,
  };
}

async function fetchMetaDaily(startDate, endDate) {
  const token     = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_ACCOUNT_ID || process.env.META_AD_ACCOUNT_ID;
  const version   = process.env.META_API_VERSION || 'v19.0';

  if (!token || !accountId) return [];

  const url = `https://graph.facebook.com/${version}/${accountId}/insights` +
    `?fields=spend,clicks,impressions,actions` +
    `&time_range={"since":"${startDate}","until":"${endDate}"}` +
    `&time_increment=1&level=account&limit=90&access_token=${token}`;

  const res  = await fetch(url);
  const data = await res.json();
  if (data.error) return [];

  return (data.data || []).map(d => {
    const parts = (d.date_start || '').split('-');
    return {
      date:        parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.date_start,
      spend:       parseFloat(d.spend       || 0),
      clicks:      parseInt(d.clicks        || 0),
      impressions: parseInt(d.impressions   || 0),
      msgs:        sumActions(d.actions, MSG_TYPES),
    };
  }).filter(d => d.date);
}

function calcProjections(meta, google, startDate) {
  const start       = new Date(startDate);
  const today       = new Date();
  const daysElapsed = Math.max(1, Math.ceil((today - start) / 86400000));

  const totalSpend  = meta.spend + google.spend;
  const totalClicks = meta.clicks + google.clicks;

  const dailySpend  = totalSpend  / daysElapsed;
  const dailyClicks = totalClicks / daysElapsed;
  const dailyMsgs   = meta.msgs   / daysElapsed;

  return {
    daysElapsed,
    dailySpend,
    monthlySpend:  dailySpend  * 30,
    monthlyClicks: Math.round(dailyClicks * 30),
    monthlyMsgs:   Math.round(dailyMsgs   * 30),
    paceLabel:     `${daysElapsed} dias computados`,
  };
}

// GET /api/live-dashboard?days=30  OU  ?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/', async (req, res) => {
  let startDate, endDate;

  if (req.query.start && req.query.end) {
    startDate = req.query.start;
    endDate   = req.query.end;
  } else {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days || '30')));
    const end   = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    startDate = start.toISOString().split('T')[0];
    endDate   = end.toISOString().split('T')[0];
  }

  const cKey   = `live_${startDate}_${endDate}`;
  const cached = getCached(cKey);
  if (cached) return res.json(cached);

  try {
    // ── Meta ──────────────────────────────────────────────────────
    const [metaRes, dailyRes] = await Promise.allSettled([
      fetchMeta(startDate, endDate),
      fetchMetaDaily(startDate, endDate),
    ]);

    const meta = metaRes.status === 'fulfilled'
      ? metaRes.value
      : { spend: 0, clicks: 0, impressions: 0, msgs: 0, cpc: 0, cpm: 0, costPerMsg: 0 };

    const metaError = metaRes.status === 'rejected' ? metaRes.reason?.message : null;
    const daily     = dailyRes.status === 'fulfilled' ? dailyRes.value : [];
    const schedulingRes = await Promise.allSettled([schedulingSystem.getMarketingPerformance(startDate, endDate)]);
    const scheduling = schedulingRes[0].status === 'fulfilled' ? schedulingRes[0].value : null;
    const schedulingError = schedulingRes[0].status === 'rejected' ? schedulingRes[0].reason?.message : null;

    // ── Google Ads ─────────────────────────────────────────────────
    let googleStores = STORES.map(s => ({ ...s, spend: 0, clicks: 0, impressions: 0, conversions: 0 }));
    let googleError  = null;
    let googleToken  = null;

    try {
      googleToken = await refreshGoogleToken();
    } catch (e) {
      googleError = e.message;
      console.error('[LiveDashboard] Google OAuth:', e.message);
    }

    if (googleToken) {
      const results = await Promise.allSettled(
        STORES.map(s => fetchGoogleAdsStore(googleToken, s.id, startDate, endDate))
      );
      googleStores = STORES.map((s, i) => {
        const r = results[i];
        if (r.status === 'rejected') {
          console.error(`[LiveDashboard] Google ${s.name}:`, r.reason?.message);
          return { ...s, spend: 0, clicks: 0, impressions: 0, conversions: 0 };
        }
        return { name: s.name, color: s.color, ...r.value };
      });
    }

    const google = {
      spend:       googleStores.reduce((s, r) => s + r.spend,       0),
      clicks:      googleStores.reduce((s, r) => s + r.clicks,      0),
      impressions: googleStores.reduce((s, r) => s + r.impressions, 0),
      conversions: googleStores.reduce((s, r) => s + r.conversions, 0),
      stores:      googleStores.map(s => ({ name: s.name, color: s.color, spend: s.spend, clicks: s.clicks, conversions: s.conversions })),
      cpc: googleStores.reduce((s, r) => s + r.clicks, 0) > 0
        ? googleStores.reduce((s, r) => s + r.spend, 0) / googleStores.reduce((s, r) => s + r.clicks, 0)
        : 0,
    };

    const totals = {
      spend:       meta.spend  + google.spend,
      clicks:      meta.clicks + google.clicks,
      msgs:        meta.msgs,
      conversions: google.conversions,
    };

    const result = {
      meta,
      google,
      daily,
      totals,
      scheduling,
      projections:          calcProjections(meta, google, startDate),
      period:               { startDate, endDate },
      updatedAt:            new Date().toLocaleTimeString('pt-BR'),
      googleTokenAvailable: !!googleToken,
      ...(metaError   ? { metaError }   : {}),
      ...(googleError ? { googleError } : {}),
      ...(schedulingError ? { schedulingError } : {}),
    };

    setCached(cKey, result);
    res.json(result);

  } catch (err) {
    console.error('[LiveDashboard] GET /:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/cache/clear', (req, res) => {
  liveCache.clear();
  res.json({ ok: true });
});

module.exports = router;
