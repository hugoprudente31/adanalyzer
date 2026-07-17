/**
 * AdAnalyzer — analytics.routes.js (dinâmico)
 * Inclui endpoint /refresh para forçar atualização de contas.
 */

const express = require("express");
const router  = express.Router();
const sm      = require("../services/marketingDb.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── Contas (dinâmicas) ────────────────────────────────────────

// GET /api/analytics/accounts
router.get("/accounts", asyncHandler(async (req, res) => {
  const data = await sm.discovery.discoverAllAccounts();
  res.json({ success: true, data });
}));

// POST /api/analytics/accounts/refresh
router.post("/accounts/refresh", asyncHandler(async (req, res) => {
  const data = await sm.discovery.refreshAllAccounts();
  res.json({ success: true, message: "Contas atualizadas com sucesso", data });
}));

// GET /api/analytics/accounts/cache
router.get("/accounts/cache", (req, res) => {
  res.json({
    success: true,
    cacheTTL_ms: Number(process.env.ACCOUNTS_CACHE_TTL_MS) || 300000,
    status: sm.discovery.cache.status(),
  });
});

// ── Dashboard ─────────────────────────────────────────────────

// GET /api/analytics/dashboard?period=last_30_days
router.get("/dashboard", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await sm.getFullReport({ datePreset: period });
  res.json({ success: true, data });
}));

// ── Google Ads ────────────────────────────────────────────────

// GET /api/analytics/google-ads
router.get("/google-ads", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await sm.getGoogleAdsDashboard({ datePreset: period });
  res.json({ success: true, count: data.length, data });
}));

// GET /api/analytics/google-ads/compare
router.get("/google-ads/compare", asyncHandler(async (req, res) => {
  const { metric = "cost", period = "last_30_days" } = req.query;
  const data = await sm.compareGoogleAdsAccounts({ datePreset: period, metric });
  res.json({ success: true, data });
}));

// GET /api/analytics/google-ads/:query
router.get("/google-ads/:query", asyncHandler(async (req, res) => {
  const { period = "last_30_days", since, until, reportType = "campaign" } = req.query;
  const result = await sm.getGoogleAdsMetrics(req.params.query, { datePreset: period, startDate: since, endDate: until, reportType });
  res.json({ success: true, ...result });
}));

// ── GA4 ───────────────────────────────────────────────────────

// GET /api/analytics/ga4
router.get("/ga4", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await sm.getAllGA4Metrics({ datePreset: period });
  res.json({ success: true, count: data.length, data });
}));

// GET /api/analytics/ga4/:query
router.get("/ga4/:query", asyncHandler(async (req, res) => {
  const { period = "last_30_days", since, until } = req.query;
  const result = await sm.getGA4Metrics(req.params.query, { datePreset: period, startDate: since, endDate: until });
  res.json({ success: true, ...result });
}));

// ── Search Console ────────────────────────────────────────────

// GET /api/analytics/search-console
router.get("/search-console", asyncHandler(async (req, res) => {
  const { period = "last_30_days", since, until } = req.query;
  const data = await sm.getSearchConsoleMetrics({ datePreset: period, startDate: since, endDate: until });
  res.json({ success: true, data });
}));

// ── Error handler ─────────────────────────────────────────────

router.use((err, req, res, _next) => {
  console.error("[Analytics Route Error]", err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
