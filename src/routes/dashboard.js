/**
 * AdAnalyzer — dashboard.js
 * Rotas /api/dashboard/* — conecta Meta Ads service aos módulos de análise.
 */

const express = require("express");
const router  = express.Router();

const { runAlerts }      = require("../modules/optimizationAlerts");
const { generateReport } = require("../modules/performanceReport");
const metaAds            = require("../services/metaAds");
const schedulingSystem   = require("../services/schedulingSystem");

// Cache em memória (5 minutos) — rotas existentes
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// ── Cache 60s exclusivo do endpoint /api/dashboard ─────────────
const dashCache = new Map();
const DASH_TTL  = 60 * 1000;

function getDashCached(key) {
  const e = dashCache.get(key);
  if (!e || Date.now() - e.ts > DASH_TTL) { dashCache.delete(key); return null; }
  return e.data;
}
function setDashCached(key, data) {
  dashCache.set(key, { data, ts: Date.now() });
}

// ── Mapeamento de objetivos Meta ──────────────────────────────
const OBJ_META = {
  OUTCOME_LEADS:      { name: "Leads",       color: "#10b981" },
  LEAD_GENERATION:    { name: "Leads",       color: "#10b981" },
  OUTCOME_TRAFFIC:    { name: "Tráfego",     color: "#3b82f6" },
  LINK_CLICKS:        { name: "Tráfego",     color: "#3b82f6" },
  OUTCOME_ENGAGEMENT: { name: "Engajamento", color: "#f59e0b" },
  VIDEO_VIEWS:        { name: "Engajamento", color: "#f59e0b" },
  POST_ENGAGEMENT:    { name: "Engajamento", color: "#f59e0b" },
  OUTCOME_AWARENESS:  { name: "Autoridade",  color: "#8b5cf6" },
  BRAND_AWARENESS:    { name: "Autoridade",  color: "#8b5cf6" },
  REACH:              { name: "Autoridade",  color: "#8b5cf6" },
  OUTCOME_SALES:      { name: "Vendas",      color: "#f43f5e" },
  CONVERSIONS:        { name: "Vendas",      color: "#f43f5e" },
  MESSAGES:           { name: "Mensagens",   color: "#06b6d4" },
};

const GOOGLE_STORES = [
  { id: "9212873095", name: "Gonzaga",       color: "#f59e0b" },
  { id: "4121362472", name: "Pitangueiras",  color: "#3b82f6" },
  { id: "5679539198", name: "Santo Antônio", color: "#10b981" },
  { id: "1420756198", name: "Enseada",       color: "#f43f5e" },
];

// ── Supermetrics REST API ─────────────────────────────────────
async function smRESTQuery({ ds_id, ds_accounts, fields, start_date, end_date, date_range_type = "custom" }) {
  const apiKey = process.env.SUPERMETRICS_API_KEY;
  const dsUser = process.env.SUPERMETRICS_DS_USER;
  if (!apiKey || !dsUser) throw new Error("SUPERMETRICS_API_KEY ou SUPERMETRICS_DS_USER não configurados");

  const params = {
    api_key:         apiKey,
    ds_user:         dsUser,
    ds_id,
    ds_accounts,
    date_range_type,
    fields:          Array.isArray(fields) ? fields.join(",") : fields,
    max_rows:        10000,
  };
  if (date_range_type === "custom") { params.start_date = start_date; params.end_date = end_date; }

  const url = `https://api.supermetrics.com/enterprise/v2/query/data/json?json=${encodeURIComponent(JSON.stringify(params))}`;
  const res  = await fetch(url);
  const data = await res.json();

  if (data.error) throw new Error(`Supermetrics: ${data.error.message || JSON.stringify(data.error)}`);

  const rows    = data.data?.rows    || [];
  const headers = data.data?.headers || [];
  if (!rows.length) return [];

  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h.id ?? h] = row[i] ?? null; });
    return obj;
  });
}

// ── Helpers Meta actions ──────────────────────────────────────
const MSG_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "new_messaging_connections",
  "onsite_conversion.messaging_first_reply",
];

function sumActions(actions, types) {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseInt(a.value || 0), 0);
}

// ── GET /api/dashboard?start=YYYY-MM-DD&end=YYYY-MM-DD ────────
router.get("/", async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "Parâmetros start e end são obrigatórios" });
  }

  const cKey = `dash_${start}_${end}`;
  const cached = getDashCached(cKey);
  if (cached) return res.json(cached);

  try {
    const [campRes, dailyRes, campListRes, ...googleRes] = await Promise.allSettled([
      // Meta — insights por campanha
      metaAds.getInsights({ dateRange: { since: start, until: end }, level: "campaign" }),
      // Meta — série diária
      metaAds.getInsights({ dateRange: { since: start, until: end }, level: "account", timeIncrement: 1 }),
      // Meta — lista de campanhas para objetivo
      metaAds.getCampaigns({ status: "ALL" }),
      // Google Ads — 4 lojas via Supermetrics REST API
      ...GOOGLE_STORES.map(s => smRESTQuery({
        ds_id:           "AW",
        ds_accounts:     s.id,
        fields:          ["Impressions", "Clicks", "Cost", "Conversions"],
        date_range_type: "custom",
        start_date:      start,
        end_date:        end,
      })),
    ]);

    if (campRes.status === "rejected") console.error("[Dashboard] Meta campaigns:", campRes.reason?.message);
    if (dailyRes.status === "rejected") console.error("[Dashboard] Meta daily:", dailyRes.reason?.message);
    if (campListRes.status === "rejected") console.error("[Dashboard] Meta campList:", campListRes.reason?.message);

    const campaigns = campRes.status     === "fulfilled" ? campRes.value     : [];
    const dailyData = dailyRes.status    === "fulfilled" ? dailyRes.value    : [];
    const campList  = campListRes.status === "fulfilled" ? campListRes.value : [];
    const metaError = campRes.status === "rejected" ? campRes.reason?.message : null;

    // campaign_id → objective
    const objMap = {};
    for (const c of campList) { if (c.id) objMap[c.id] = c.objective || "OUTRO"; }

    // ── Meta: totais ─────────────────────────────────────────────
    let metaSpend = 0, metaClicks = 0, metaImpr = 0, metaMsgs = 0;
    const byObj = {};

    for (const c of campaigns) {
      const spend  = parseFloat(c.spend        || 0);
      const clicks = parseInt(c.clicks         || 0);
      const impr   = parseInt(c.impressions    || 0);
      const msgs   = sumActions(c.actions, MSG_TYPES);

      metaSpend  += spend;
      metaClicks += clicks;
      metaImpr   += impr;
      metaMsgs   += msgs;

      const obj = objMap[c.campaign_id] || "OUTRO";
      if (!byObj[obj]) byObj[obj] = { spend: 0, msgs: 0, clicks: 0 };
      byObj[obj].spend  += spend;
      byObj[obj].msgs   += msgs;
      byObj[obj].clicks += clicks;
    }

    const objectives = Object.entries(byObj)
      .map(([obj, d]) => {
        const m = OBJ_META[obj] || { name: obj, color: "#64748b" };
        return { name: m.name, spend: d.spend, msgs: d.msgs, cpc: d.clicks > 0 ? d.spend / d.clicks : 0, color: m.color };
      })
      .sort((a, b) => b.spend - a.spend);

    // ── Meta: série diária ────────────────────────────────────────
    const daily = dailyData.map(d => {
      const parts = (d.date_start || "").split("-");
      return {
        date:        parts.length === 3 ? `${parts[2]}/${parts[1]}` : (d.date_start || ""),
        clicks:      parseInt(d.clicks      || 0),
        impressions: parseInt(d.impressions || 0),
        msgs:        sumActions(d.actions, MSG_TYPES),
        spend:       parseFloat(d.spend     || 0),
      };
    }).filter(d => d.date);

    // ── Google Ads via Supermetrics REST ─────────────────────────
    if (googleRes.some(r => r.status === "rejected")) {
      googleRes.forEach((r, i) => {
        if (r.status === "rejected") console.error(`[Dashboard] Google ${GOOGLE_STORES[i].name}:`, r.reason?.message);
      });
    }
    const stores = GOOGLE_STORES.map((store, i) => {
      if (googleRes[i]?.status !== "fulfilled") return { name: store.name, spend: 0, clicks: 0, color: store.color };
      const rows = googleRes[i].value;
      return {
        name:   store.name,
        spend:  rows.reduce((s, r) => s + parseFloat(r.Cost  || r.cost  || 0), 0),
        clicks: rows.reduce((s, r) => s + parseInt(r.Clicks || r.clicks || 0), 0),
        color:  store.color,
      };
    });
    const gSpend       = stores.reduce((s, st) => s + st.spend,  0);
    const gClicks      = stores.reduce((s, st) => s + st.clicks, 0);
    const gConversions = googleRes.reduce((s, r) => {
      if (r.status !== "fulfilled") return s;
      return s + r.value.reduce((rs, row) => rs + parseFloat(row.Conversions || row.conversions || 0), 0);
    }, 0);
    const schedulingResult = await Promise.allSettled([schedulingSystem.getMarketingPerformance(start, end)]);
    const scheduling = schedulingResult[0].status === "fulfilled" ? schedulingResult[0].value : null;

    const result = {
      meta: {
        spend:       metaSpend,
        clicks:      metaClicks,
        impressions: metaImpr,
        msgs:        metaMsgs,
        cpc:         metaClicks > 0 ? metaSpend / metaClicks        : 0,
        cpm:         metaImpr   > 0 ? (metaSpend * 1000) / metaImpr : 0,
        costPerMsg:  metaMsgs   > 0 ? metaSpend / metaMsgs          : 0,
        objectives,
      },
      google: { spend: gSpend, clicks: gClicks, impressions: 0, conversions: gConversions, cpc: gClicks > 0 ? gSpend / gClicks : 0, stores },
      daily,
      scheduling,
      updatedAt: new Date().toLocaleTimeString("pt-BR"),
      ...(metaError ? { metaError } : {}),
      googleError: googleRes.find(r => r.status === "rejected")?.reason?.message || null,
      schedulingError: schedulingResult[0].status === "rejected" ? schedulingResult[0].reason?.message : null,
    };

    setDashCached(cKey, result);
    res.json(result);

  } catch (err) {
    console.error("[Dashboard] GET /:", err.message);
    res.status(500).json({ error: err.message });
  }
});

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

async function fetchCampaigns({ since, until, datePreset } = {}) {
  if (since && until) {
    return metaAds.getInsights({ dateRange: { since, until }, level: "campaign" });
  }
  return metaAds.getInsights({ datePreset: datePreset || "last_30d", level: "campaign" });
}

function parseDateParams(query) {
  const { since, until, preset } = query;
  if (since && until) return { since, until };
  if (preset) return { datePreset: preset };
  return {};
}

function cacheKey(base, query) {
  const { since, until, preset } = query;
  if (since && until) return `${base}_${since}_${until}`;
  if (preset) return `${base}_${preset}`;
  return base;
}

// GET /api/dashboard/report?since=2026-05-01&until=2026-05-24
router.get("/report", async (req, res) => {
  try {
    const key    = cacheKey("report", req.query);
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const campaigns = await fetchCampaigns(parseDateParams(req.query));
    const report    = generateReport(campaigns);

    setCached(key, report);
    res.json(report);
  } catch (err) {
    console.error("[Dashboard] /report:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/alerts?since=2026-05-01&until=2026-05-24
router.get("/alerts", async (req, res) => {
  try {
    const key    = cacheKey("alerts", req.query);
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const campaigns = await fetchCampaigns(parseDateParams(req.query));
    const result    = await runAlerts(campaigns);

    setCached(key, result);
    res.json(result);
  } catch (err) {
    console.error("[Dashboard] /alerts:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/summary?since=2026-05-01&until=2026-05-24
router.get("/summary", async (req, res) => {
  try {
    const campaigns = await fetchCampaigns(parseDateParams(req.query));
    const report    = generateReport(campaigns);
    res.json({
      period:     req.query.since ? `${req.query.since} → ${req.query.until}` : (req.query.preset || "last_30d"),
      grandTotal: report.grandTotal,
      stores:     report.stores.map((s) => ({
        store:           s.store,
        color:           s.color,
        spend:           s.metrics.spend.formatted,
        actions:         s.metrics.actions.formatted,
        ctr:             s.metrics.ctr.formatted,
        cpc:             s.metrics.cpc.formatted,
        activeCampaigns: s.activeCampaigns,
      })),
      generatedAt: report.generatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/unmatched — lista campanhas que caíram em "Outros"
router.get("/unmatched", async (req, res) => {
  try {
    const { resolveStore } = require("../modules/storeConsolidation");
    const campaigns = await fetchCampaigns();
    const unmatched = campaigns
      .filter((c) => resolveStore(c.campaign_name || c.name) === "Outros")
      .map((c) => ({
        name:    c.campaign_name || c.name,
        spend:   Number(c.spend || 0).toFixed(2),
        actions: Array.isArray(c.actions)
          ? c.actions.reduce((s, a) => s + Number(a.value || 0), 0)
          : Number(c.actions || 0),
        ctr: c.ctr ? `${Number(c.ctr).toFixed(2)}%` : "-",
      }))
      .sort((a, b) => Number(b.spend) - Number(a.spend));

    res.json({ total: unmatched.length, campaigns: unmatched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/cache/clear
router.post("/cache/clear", (req, res) => {
  cache.clear();
  res.json({ ok: true, message: "Cache limpo." });
});

module.exports = router;
