/**
 * AdAnalyzer — dashboard.js
 * Rotas /api/dashboard/* — conecta Meta Ads service aos módulos de análise.
 */

const express = require("express");
const router  = express.Router();

const { runAlerts }      = require("../modules/optimizationAlerts");
const { generateReport } = require("../modules/performanceReport");
const metaAds            = require("../services/metaAds");

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

// ── Helpers para processar dados Meta ─────────────────────────
function extractMsgs(actions) {
  if (!Array.isArray(actions)) return 0;
  const MSG_TYPES = [
    "onsite_conversion.messaging_conversation_started_7d",
    "new_messaging_connections",
    "onsite_conversion.messaging_first_reply",
  ];
  const found = actions.find(a => MSG_TYPES.includes(a.action_type));
  return parseInt(found?.value || 0);
}

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

// ── Supermetrics: submit → poll → parse ───────────────────────

const SM_BASE = () =>
  process.env.SUPERMETRICS_MCP_URL || "https://mcp.supermetrics.com/mcp";

async function smHttp(tool, params) {
  const res = await fetch(`${SM_BASE()}/tools/${tool}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(params),
  });
  return res.json();
}

async function smPoll(scheduleId, maxAttempts = 14) {
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1800));
    const r = await smHttp("get_async_query_results", { schedule_id: scheduleId });
    const status = r?.data?.status ?? r?.status;
    if (status === "completed") return r?.data?.data ?? r?.data;
    if (status === "failed") throw new Error("Supermetrics query failed");
  }
  throw new Error("Supermetrics timeout");
}

// Parser do formato texto comprimido do Supermetrics:
// "  - [N,]: val1,val2,..."
function smParse(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    if (raw.length < 2) return [];
    const headers = raw[0];
    return raw.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] ?? null; });
      return obj;
    });
  }
  // Formato texto
  const lines = String(raw)
    .split("\n")
    .map(l => l.replace(/^\s*-\s*\[\d+,?\]:\s*/, "").trim())
    .filter(l => l && !l.startsWith("["));
  if (lines.length < 2) return [];

  const parseCSV = (line) => {
    const out = []; let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseCSV(lines[0]);
  return lines.slice(1).map(l => {
    const vals = parseCSV(l);
    const obj  = {};
    headers.forEach((h, i) => {
      const v = vals[i];
      obj[h] = (v === "null" || v == null) ? null : v;
    });
    return obj;
  });
}

async function smQuery(params) {
  const submitted = await smHttp("data_query", params);
  if (!submitted.success && submitted.error) throw new Error(submitted.error);
  const schedId = submitted?.data?.schedule_id ?? submitted?.schedule_id;
  if (!schedId) throw new Error("Supermetrics não retornou schedule_id");
  const raw = await smPoll(schedId);
  return smParse(raw);
}

// ── Helpers de soma de linhas SM ──────────────────────────────
const smN = (row, ...keys) => {
  for (const k of keys) {
    const v = parseFloat(row[k]);
    if (!isNaN(v)) return v;
  }
  return 0;
};

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
    // Busca paralela: Meta campanhas + Meta diário + Google por loja (4x)
    const [metaCampRes, metaDailyRes, ...googleRes] = await Promise.allSettled([

      // Meta — campanhas com objetivo (field IDs confirmados via Supermetrics)
      smQuery({
        ds_id:           "FA",
        ds_accounts:     "act_541456155580439",
        fields:          "adcampaign_name,campaignobjective,impressions,action_link_click,new_messaging_conversations_7d,cost,CPC",
        date_range_type: "custom",
        start_date:      start,
        end_date:        end,
      }),

      // Meta — série diária
      smQuery({
        ds_id:           "FA",
        ds_accounts:     "act_541456155580439",
        fields:          "date_start,impressions,action_link_click,new_messaging_conversations_7d,cost",
        date_range_type: "custom",
        start_date:      start,
        end_date:        end,
      }),

      // Google Ads — 4 lojas separadas (field IDs confirmados)
      ...GOOGLE_STORES.map(s =>
        smQuery({
          ds_id:           "AW",
          ds_accounts:     s.id,
          fields:          "Impressions,Clicks,Cost,CPC,Conversions",
          date_range_type: "custom",
          start_date:      start,
          end_date:        end,
          settings:        { exclude_invalid_accounts: true },
        })
      ),
    ]);

    // ── Meta: totais agregados ────────────────────────────────────
    const metaRows = metaCampRes.status === "fulfilled" ? metaCampRes.value : [];

    const metaSpend  = metaRows.reduce((s, r) => s + smN(r, "cost", "Amount spent"), 0);
    const metaClicks = metaRows.reduce((s, r) => s + smN(r, "action_link_click", "Link clicks"), 0);
    const metaImpr   = metaRows.reduce((s, r) => s + smN(r, "impressions", "Impressions"), 0);
    const metaMsgs   = metaRows.reduce((s, r) => s + smN(r, "new_messaging_conversations_7d", "Messaging conversations started"), 0);

    // ── Meta: objetivos ───────────────────────────────────────────
    const byObj = {};
    for (const r of metaRows) {
      const obj = r.campaignobjective || r["Campaign objective"] || "OUTRO";
      if (!byObj[obj]) byObj[obj] = { spend: 0, msgs: 0, clicks: 0 };
      byObj[obj].spend  += smN(r, "cost", "Amount spent");
      byObj[obj].msgs   += smN(r, "new_messaging_conversations_7d", "Messaging conversations started");
      byObj[obj].clicks += smN(r, "action_link_click", "Link clicks");
    }

    const objectives = Object.entries(byObj)
      .map(([obj, d]) => {
        const m = OBJ_META[obj] || { name: obj, color: "#64748b" };
        return {
          name:  m.name,
          spend: d.spend,
          msgs:  d.msgs,
          cpc:   d.clicks > 0 ? d.spend / d.clicks : 0,
          color: m.color,
        };
      })
      .sort((a, b) => b.spend - a.spend);

    // ── Meta diário ──────────────────────────────────────────────
    const dailyRows = metaDailyRes.status === "fulfilled" ? metaDailyRes.value : [];
    const daily = dailyRows.map(r => {
      const dateStr = r["date_start"] || r["Date"] || "";
      const parts   = dateStr.split("-");
      return {
        date:        parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr,
        clicks:      Math.round(smN(r, "action_link_click", "Link clicks")),
        impressions: Math.round(smN(r, "impressions", "Impressions")),
        msgs:        Math.round(smN(r, "new_messaging_conversations_7d", "Messaging conversations started")),
        spend:       smN(r, "cost", "Cost"),
      };
    }).filter(d => d.date);

    // ── Google Ads por loja ──────────────────────────────────────
    const stores = GOOGLE_STORES.map((store, i) => {
      if (googleRes[i].status !== "fulfilled") {
        return { name: store.name, spend: 0, clicks: 0, color: store.color };
      }
      const rows = googleRes[i].value;
      return {
        name:   store.name,
        spend:  rows.reduce((s, r) => s + smN(r, "Cost"), 0),
        clicks: rows.reduce((s, r) => s + Math.round(smN(r, "Clicks")), 0),
        color:  store.color,
      };
    });

    const gSpend       = stores.reduce((s, st) => s + st.spend,  0);
    const gClicks      = stores.reduce((s, st) => s + st.clicks, 0);
    const gConversions = googleRes.reduce((s, r) => {
      if (r.status !== "fulfilled") return s;
      return s + r.value.reduce((rs, row) => rs + smN(row, "Conversions"), 0);
    }, 0);

    const result = {
      meta: {
        spend:      metaSpend,
        clicks:     metaClicks,
        impressions: metaImpr,
        msgs:       metaMsgs,
        cpc:        metaClicks > 0  ? metaSpend / metaClicks        : 0,
        cpm:        metaImpr   > 0  ? (metaSpend * 1000) / metaImpr : 0,
        costPerMsg: metaMsgs   > 0  ? metaSpend / metaMsgs          : 0,
        objectives,
      },
      google: {
        spend:       gSpend,
        clicks:      gClicks,
        impressions: 0,
        conversions: gConversions,
        cpc:         gClicks > 0 ? gSpend / gClicks : 0,
        stores,
      },
      daily,
      updatedAt: new Date().toLocaleTimeString("pt-BR"),
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
