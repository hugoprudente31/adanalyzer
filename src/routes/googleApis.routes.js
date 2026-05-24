/**
 * AdAnalyzer — googleApis.routes.js
 * Endpoints para GA4, Search Console e Tag Manager.
 */

const express = require("express");
const router  = express.Router();
const google  = require("../services/googleApis.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/google/status
router.get("/status", (req, res) => {
  const { getAuthenticatedClient } = require("../routes/googleOAuth");
  try {
    getAuthenticatedClient();
    res.json({ connected: true, message: "Google autenticado" });
  } catch (e) {
    res.json({ connected: false, message: e.message, loginUrl: "/auth/google" });
  }
});

// GET /api/google/dashboard
router.get("/dashboard", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await google.getFullGoogleReport(period);
  res.json({ success: true, data });
}));

// GET /api/google/ga4
router.get("/ga4", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await google.getAllGA4Reports(period);
  res.json({ success: true, data });
}));

// GET /api/google/ga4/:propertyId
router.get("/ga4/:propertyId", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await google.getGA4Report({ propertyId: req.params.propertyId, dateRange: period });
  res.json({ success: true, propertyId: req.params.propertyId, data });
}));

// GET /api/google/search-console
router.get("/search-console", asyncHandler(async (req, res) => {
  const { period = "last_30_days" } = req.query;
  const data = await google.getAllSearchConsoleData(period);
  res.json({ success: true, data });
}));

// GET /api/google/gtm
router.get("/gtm", asyncHandler(async (req, res) => {
  const data = await google.getGTMAccounts();
  res.json({ success: true, data });
}));

// GET /api/google/gtm/:accountId/containers
router.get("/gtm/:accountId/containers", asyncHandler(async (req, res) => {
  const data = await google.getGTMContainers(req.params.accountId);
  res.json({ success: true, data });
}));

router.use((err, req, res, _next) => {
  console.error("[Google APIs Route Error]", err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
