/**
 * AdAnalyzer — financeiroDb.routes.js
 * Permite forçar uma sincronização manual dos dados de venda (a agendada
 * roda 04:15). Espelha o padrão de src/routes/kommoDb.routes.js — a leitura
 * desses dados fica exclusivamente em services/financeiro (NestJS).
 */

const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();
const syncFinanceiro = require("../jobs/syncFinanceiro");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.use("/sync", asyncHandler(async (req, res, next) => {
  const syncUrl = process.env.ADANALYZER_OS_SYNC_URL;
  const syncKey = process.env.ADANALYZER_OS_SYNC_KEY;
  if (req.method !== "POST" || !syncUrl || !syncKey) return next();
  const response = await fetch(`${syncUrl.replace(/\/$/, "")}/sync/all`, {
    method: "POST",
    headers: { Accept: "application/json", "x-api-key": syncKey },
    timeout: 300000,
  });
  const text = await response.text();
  res.status(response.status).type("application/json").send(text);
}));

// POST /api/financeiro/sync — força sincronização agora (a agendada roda 04:15)
router.post("/sync", asyncHandler(async (req, res) => {
  const result = await syncFinanceiro.runSync();
  res.json({ success: true, result });
}));

router.use((err, req, res, _next) => {
  console.error("[Financeiro DB Route Error]", err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
