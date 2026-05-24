/**
 * AdAnalyzer — dashboard.js
 * Rotas /api/dashboard/* — conecta Meta Ads service aos módulos de análise.
 */

const express = require("express");
const router  = express.Router();

const { runAlerts }      = require("../modules/optimizationAlerts");
const { generateReport } = require("../modules/performanceReport");
const metaAds            = require("../services/metaAds");

// Cache em memória (5 minutos)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

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
