/**
 * AdAnalyzer — kommoDb.routes.js
 * Expõe os dados do Kommo já replicados no Postgres, e permite forçar
 * uma sincronização manual.
 */

const express = require("express");
const router  = express.Router();
const kommoDb = require("../services/kommoDb.service");
const syncKommo = require("../jobs/syncKommoData");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/kommo/status
router.get("/status", asyncHandler(async (req, res) => {
  const data = await kommoDb.getSyncStatus();
  res.json({ success: true, data });
}));

// GET /api/kommo/funnel?since=2026-01-01&until=2026-07-17
router.get("/funnel", asyncHandler(async (req, res) => {
  const { since, until } = req.query;
  const data = await kommoDb.getFunnelSummary({ since, until });
  res.json({ success: true, data });
}));

// GET /api/kommo/leads-by-source?since=...&until=...
router.get("/leads-by-source", asyncHandler(async (req, res) => {
  const { since, until } = req.query;
  const data = await kommoDb.getLeadsByUtmSource({ since, until });
  res.json({ success: true, data });
}));

// POST /api/kommo/sync — força sincronização agora (a agendada roda 03:45)
router.post("/sync", asyncHandler(async (req, res) => {
  const result = await syncKommo.runSync();
  res.json({ success: true, result });
}));

router.use((err, req, res, _next) => {
  console.error("[Kommo DB Route Error]", err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
