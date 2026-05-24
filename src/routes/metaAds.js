/**
 * AdAnalyzer — Rotas Meta Ads
 */

const express = require("express");
const router = express.Router();
const meta = require("../services/metaAds");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/meta/validate
router.get("/validate", asyncHandler(async (req, res) => {
  const result = await meta.validateToken();
  res.json({ success: true, data: result });
}));

// GET /api/meta/dashboard
router.get("/dashboard", asyncHandler(async (req, res) => {
  const data = await meta.getDashboardSummary();
  res.json({ success: true, data });
}));

// GET /api/meta/campaigns?status=ACTIVE
router.get("/campaigns", asyncHandler(async (req, res) => {
  const { status = "ALL" } = req.query;
  const data = await meta.getCampaigns({ status });
  res.json({ success: true, count: data.length, data });
}));

// GET /api/meta/campaigns/:id/insights
router.get("/campaigns/:id/insights", asyncHandler(async (req, res) => {
  const { since, until } = req.query;
  const data = await meta.getCampaignInsights(req.params.id, { since, until });
  res.json({ success: true, data });
}));

// GET /api/meta/adsets
router.get("/adsets", asyncHandler(async (req, res) => {
  const { campaignId, status = "ALL" } = req.query;
  const data = await meta.getAdSets({ campaignId, status });
  res.json({ success: true, count: data.length, data });
}));

// GET /api/meta/adsets/:id/insights
router.get("/adsets/:id/insights", asyncHandler(async (req, res) => {
  const { since, until } = req.query;
  const data = await meta.getAdSetInsights(req.params.id, { since, until });
  res.json({ success: true, data });
}));

// GET /api/meta/ads
router.get("/ads", asyncHandler(async (req, res) => {
  const { campaignId, adSetId, status = "ALL" } = req.query;
  const data = await meta.getAds({ campaignId, adSetId, status });
  res.json({ success: true, count: data.length, data });
}));

// GET /api/meta/ads/:id/insights
router.get("/ads/:id/insights", asyncHandler(async (req, res) => {
  const { since, until } = req.query;
  const data = await meta.getAdInsights(req.params.id, { since, until });
  res.json({ success: true, data });
}));

// GET /api/meta/insights
router.get("/insights", asyncHandler(async (req, res) => {
  const { datePreset, since, until, level = "campaign", breakdowns, timeIncrement } = req.query;
  const data = await meta.getInsights({
    datePreset,
    dateRange: { since, until },
    level,
    breakdowns: breakdowns ? breakdowns.split(",") : [],
    timeIncrement,
  });
  res.json({ success: true, count: data.length, data });
}));

router.use((err, req, res, _next) => {
  console.error("[Meta Ads Route Error]", err.message);
  const isMetaError = err.message.startsWith("Meta API Error");
  res.status(isMetaError ? 400 : 500).json({ success: false, error: err.message });
});

module.exports = router;
