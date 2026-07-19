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

// GET /api/kommo/summary — KPIs do dashboard (pipeline ativo, ganhos, quentes, em risco)
router.get("/summary", asyncHandler(async (req, res) => {
  const data = await kommoDb.getDashboardSummary();
  res.json({ success: true, data });
}));

// GET /api/kommo/pipelines — os 4 funis reais com seus estagios
router.get("/pipelines", asyncHandler(async (req, res) => {
  const data = await kommoDb.getPipelinesWithStages();
  res.json({ success: true, data });
}));

// GET /api/kommo/pipelines/:id/board — quadro kanban de um funil
router.get("/pipelines/:id/board", asyncHandler(async (req, res) => {
  const data = await kommoDb.getPipelineBoard(Number(req.params.id));
  if (!data) return res.status(404).json({ success: false, error: "Funil não encontrado ou ainda não sincronizado" });
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
