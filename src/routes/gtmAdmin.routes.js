/**
 * AdAnalyzer — gtmAdmin.routes.js
 * Endpoints para auto-provisionamento de tags GTM.
 */

const express = require("express");
const router  = express.Router();
const gtm     = require("../services/gtmProvisioning.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/gtm/status — lista containers e status das tags
router.get("/status", asyncHandler(async (req, res) => {
  const data = await gtm.getContainersStatus();
  res.json({ success: true, total: data.length, data });
}));

// GET /api/gtm/streams — lista measurement IDs do GA4 (G-XXXXXXXX)
router.get("/streams", asyncHandler(async (req, res) => {
  const data = await gtm.discoverGA4Streams();
  res.json({ success: true, total: data.length, data });
}));

// POST /api/gtm/provision — provisiona tags em todos os containers configurados
// Body (opcional): { onlyMissing: true }
router.post("/provision", asyncHandler(async (req, res) => {
  const { onlyMissing = true } = req.body || {};
  const results = await gtm.provisionAll({ onlyMissing });
  const success = results.filter((r) => r.success).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed  = results.filter((r) => r.success === false).length;
  res.json({ success: true, summary: { success, skipped, failed }, results });
}));

// POST /api/gtm/provision/:publicId — provisiona um container específico
router.post("/provision/:publicId", asyncHandler(async (req, res) => {
  const containers = await gtm.getContainersStatus();
  const container  = containers.find((c) => c.publicId === req.params.publicId);

  if (!container) {
    return res.status(404).json({ success: false, error: "Container não encontrado" });
  }
  if (!container.configured) {
    return res.status(400).json({ success: false, error: "Container não está no gtm.config.js" });
  }

  const result = await gtm.provisionContainer({
    containerPath:    container.containerPath,
    pixelId:          container.pixelId,
    ga4MeasurementId: container.ga4MeasurementId,
    containerName:    container.name,
  });

  res.json({ success: true, result });
}));

router.use((err, req, res, _next) => {
  console.error("[GTM Admin Route Error]", err.message);
  res.status(500).json({ success: false, error: err.message });
});

module.exports = router;
