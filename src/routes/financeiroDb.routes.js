/**
 * AdAnalyzer — financeiroDb.routes.js
 * Permite forçar uma sincronização manual dos dados de venda (a agendada
 * roda 04:15). Espelha o padrão de src/routes/kommoDb.routes.js — a leitura
 * desses dados fica exclusivamente em services/financeiro (NestJS).
 */

const express = require("express");
const router = express.Router();
const syncFinanceiro = require("../jobs/syncFinanceiro");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

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
