/**
 * AdAnalyzer — kommoDb.routes.js
 * Expõe os dados do Kommo já replicados no Postgres, e permite forçar
 * uma sincronização manual.
 */

const express = require("express");
const fetch = require("node-fetch");
const router  = express.Router();
const kommoDb = require("../services/kommoDb.service");
const syncKommo = require("../jobs/syncKommoData");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const CRM_PATHS = new Map([
  ["/status", "/api/crm/v1/status"],
  ["/funnel", "/api/crm/v1/funnel"],
  ["/leads-by-source", "/api/crm/v1/leads/by-source"],
  ["/summary", "/api/crm/v1/dashboard/summary"],
  ["/pipelines", "/api/crm/v1/pipelines"],
]);

router.use(asyncHandler(async (req, res, next) => {
  const crmUrl = process.env.ADANALYZER_OS_CRM_URL;
  const crmKey = process.env.ADANALYZER_OS_CRM_KEY;
  const syncUrl = process.env.ADANALYZER_OS_SYNC_URL;
  const syncKey = process.env.ADANALYZER_OS_SYNC_KEY;

  let path = CRM_PATHS.get(req.path);
  const boardMatch = req.path.match(/^\/pipelines\/(\d+)\/board$/);
  if (boardMatch) path = `/api/crm/v1/pipelines/${boardMatch[1]}/board`;

  let target;
  let key;
  if (req.method === "GET" && path && crmUrl && crmKey) {
    const query = new URLSearchParams(req.query).toString();
    target = `${crmUrl.replace(/\/$/, "")}${path}${query ? `?${query}` : ""}`;
    key = crmKey;
  } else if (req.method === "POST" && req.path === "/sync" && syncUrl && syncKey) {
    target = `${syncUrl.replace(/\/$/, "")}/sync/all`;
    key = syncKey;
  } else {
    return next();
  }

  const response = await fetch(target, {
    method: req.method,
    headers: { Accept: "application/json", "x-api-key": key },
    timeout: req.method === "POST" ? 300000 : 30000,
  });
  const text = await response.text();
  res.status(response.status).type("application/json").send(text);
}));

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
