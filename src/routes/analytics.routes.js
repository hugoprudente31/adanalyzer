/**
 * AdAnalyzer — analytics.routes.js
 * Rotas REST para Google Ads, GA4 e Search Console.
 */

const express = require("express");
const router  = express.Router();
const sm      = require("../services/supermetrics.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/analytics/accounts
router.get("/accounts", (req, res) => {
  res.json({ success: true, data: { googleAds: sm.ACCOUNTS.googleAds, googleAnalytics: sm.ACCOUNTS.googleAnalytics, searchConsole: sm.ACCOUNTS.searchConsole } });
});

// GET /api/analytics/dashboard
router.get("/dashboard", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await sm.getFullReport({ datePreset: period });
  res.json({ success: true, data });
}));

// GET /api/analytics/google-ads
router.get("/google-ads", asyncHandler(async (req, res) => {
  const data = await sm.getGoogleAdsDashboard();
  res.json({ success: true, count: data.length, data });
}));

// GET /api/analytics/google-ads/compare
router.get("/google-ads/compare", asyncHandler(async (req, res) => {
  const { metric = "cost", period = "last_30_days" } = req.query;
  const data = await sm.compareAccounts({ datePreset: period, metric });
  res.json({ success: true, data });
}));

// GET /api/analytics/google-ads/:accountId
router.get("/google-ads/:accountId", asyncHandler(async (req, res) => {
  const { period = "last_30_days", since, until, reportType = "campaign" } = req.query;
  const data = await sm.getGoogleAdsMetrics(req.params.accountId, { datePreset: period, startDate: since, endDate: until, reportType });
  res.json({ success: true, account: req.params.accountId, data });
}));

// GET /api/analytics/ga4
router.get("/ga4", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await sm.getAllGA4Metrics({ datePreset: period });
  res.json({ success: true, count: data.length, data });
}));

// GET /api/analytics/ga4/:propertyId
router.get("/ga4/:propertyId", asyncHandler(async (req, res) => {
  const { period = "last_30_days", since, until } = req.query;
  const data = await sm.getGA4Metrics(req.params.propertyId, { datePreset: period, startDate: since, endDate: until });
  res.json({ success: true, property: req.params.propertyId, data });
}));

// GET /api/analytics/search-console
router.get("/search-console", asyncHandler(async (req, res) => {
  const { period = "last_30_days", since, until } = req.query;
  const data = await sm.getSearchConsoleMetrics({ datePreset: period, startDate: since, endDate: until });
  res.json({ success: true, data });
}));

// GET /api/analytics/search-console/keywords
router.get("/search-console/keywords", asyncHandler(async (req, res) => {
  const { limit = 20, period = "last_30_days" } = req.query;
  const data = await sm.getTopKeywords({ limit: Number(limit), datePreset: period });
  res.json({ success: true, data });
}));

router.use((err, req, res, _next) => {
  console.error("[Analytics Route Error]", err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
