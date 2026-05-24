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

async function fetchCampaigns() {
  // Busca insights por campanha dos últimos 30 dias via serviço existente
  return metaAds.getInsights({ datePreset: "last_30d", level: "campaign" });
}

// GET /api/dashboard/report
router.get("/report", async (req, res) => {
  try {
    const cached = getCached("report");
    if (cached) return res.json(cached);

    const campaigns = await fetchCampaigns();
    const report    = generateReport(campaigns);

    setCached("report", report);
    res.json(report);
  } catch (err) {
    console.error("[Dashboard] /report:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/alerts
router.get("/alerts", async (req, res) => {
  try {
    const cached = getCached("alerts");
    if (cached) return res.json(cached);

    const campaigns = await fetchCampaigns();
    const result    = await runAlerts(campaigns);

    setCached("alerts", result);
    res.json(result);
  } catch (err) {
    console.error("[Dashboard] /alerts:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/summary — visão rápida sem IA
router.get("/summary", async (req, res) => {
  try {
    const campaigns = await fetchCampaigns();
    const report    = generateReport(campaigns);
    res.json({
      grandTotal: report.grandTotal,
      stores:     report.stores.map((s) => ({
        store:          s.store,
        color:          s.color,
        spend:          s.metrics.spend.formatted,
        actions:        s.metrics.actions.formatted,
        ctr:            s.metrics.ctr.formatted,
        cpc:            s.metrics.cpc.formatted,
        activeCampaigns: s.activeCampaigns,
      })),
      generatedAt: report.generatedAt,
    });
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
