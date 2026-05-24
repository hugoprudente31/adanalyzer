/**
 * AdAnalyzer — gtmProvisioning.service.js
 * Auto-provisiona tags Meta Pixel e GA4 em containers GTM via API.
 */

const { google }             = require("googleapis");
const { getAuthenticatedClient } = require("../routes/googleOAuth");
const GTM_CONFIG             = require("../config/gtm.config");

const ALL_PAGES_TRIGGER = "2147479553"; // trigger built-in do GTM

// ── Templates de tags ────────────────────────────────────────

function metaPixelHtml(pixelId) {
  return `<!-- Meta Pixel Code - AdAnalyzer -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
(window,document,'script','https://connect.facebook.net/pt_BR/fbevents.js');
fbq('init','${pixelId}');
fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>`;
}

// ── Descoberta de streams GA4 ─────────────────────────────────

async function discoverGA4Streams() {
  const auth     = getAuthenticatedClient();
  const adminApi = google.analyticsadmin({ version: "v1beta", auth });
  const { discoverGA4Properties } = require("./googleApis.service");

  const properties = await discoverGA4Properties();
  const allStreams  = [];

  await Promise.allSettled(
    properties.map(async (prop) => {
      const resp = await adminApi.properties.dataStreams.list({
        parent: `properties/${prop.propertyId}`,
      });
      for (const s of resp.data.dataStreams || []) {
        if (s.type === "WEB_DATA_STREAM") {
          allStreams.push({
            propertyId:      prop.propertyId,
            propertyName:    prop.displayName,
            measurementId:   s.webStreamData?.measurementId,
            defaultUri:      s.webStreamData?.defaultUri,
          });
        }
      }
    })
  );

  return allStreams;
}

// ── Listagem de containers com status das tags ────────────────

async function getContainersStatus() {
  const auth       = getAuthenticatedClient();
  const tagManager = google.tagmanager({ version: "v2", auth });

  const accountsResp = await tagManager.accounts.list();
  const accounts     = accountsResp.data.account || [];

  const result = [];

  for (const account of accounts) {
    const containersResp = await tagManager.accounts.containers.list({
      parent: account.path,
    });

    for (const container of containersResp.data.container || []) {
      const config = GTM_CONFIG.find((c) => c.gtmPublicId === container.publicId);

      // Verifica tags existentes no workspace padrão
      let existingTags = [];
      try {
        const wsResp = await tagManager.accounts.containers.workspaces.list({
          parent: container.path,
        });
        const ws = wsResp.data.workspace?.[0];
        if (ws) {
          const tagsResp = await tagManager.accounts.containers.workspaces.tags.list({
            parent: ws.path,
          });
          existingTags = (tagsResp.data.tag || []).map((t) => t.name);
        }
      } catch (_) {}

      result.push({
        publicId:       container.publicId,
        name:           container.name,
        accountName:    account.name,
        containerPath:  container.path,
        configured:     !!config,
        pixelId:        config?.pixelId || null,
        ga4MeasurementId: config?.ga4MeasurementId || null,
        hasPixelTag:    existingTags.some((t) => t.toLowerCase().includes("pixel") || t.toLowerCase().includes("meta")),
        hasGA4Tag:      existingTags.some((t) => t.toLowerCase().includes("ga4") || t.toLowerCase().includes("google analytics")),
        existingTags,
      });
    }
  }

  return result;
}

// ── Provisiona tags em um container ──────────────────────────

async function provisionContainer({ containerPath, pixelId, ga4MeasurementId, containerName }) {
  const auth       = getAuthenticatedClient();
  const tagManager = google.tagmanager({ version: "v2", auth });

  const log = [];

  // Cria workspace de provisionamento
  const wsResp = await tagManager.accounts.containers.workspaces.create({
    parent: containerPath,
    requestBody: {
      name:        `AdAnalyzer - ${new Date().toLocaleDateString("pt-BR")}`,
      description: "Tags criadas automaticamente pelo AdAnalyzer",
    },
  });
  const workspacePath = wsResp.data.path;
  log.push(`Workspace criado: ${wsResp.data.name}`);

  // Cria tag Meta Pixel
  if (pixelId) {
    await tagManager.accounts.containers.workspaces.tags.create({
      parent: workspacePath,
      requestBody: {
        name: `Meta Pixel - ${pixelId}`,
        type: "html",
        parameter: [
          { type: "template", key: "html",                value: metaPixelHtml(pixelId) },
          { type: "boolean",  key: "supportDocumentWrite", value: "false" },
        ],
        firingTriggerId: [ALL_PAGES_TRIGGER],
        tagFiringOption: "oncePerPage",
      },
    });
    log.push(`Tag criada: Meta Pixel ${pixelId}`);
  }

  // Cria tag GA4 Configuration
  if (ga4MeasurementId) {
    await tagManager.accounts.containers.workspaces.tags.create({
      parent: workspacePath,
      requestBody: {
        name: `GA4 Configuration - ${ga4MeasurementId}`,
        type: "gaawc",
        parameter: [
          { type: "template", key: "measurementId", value: ga4MeasurementId },
          { type: "boolean",  key: "sendPageView",  value: "true" },
        ],
        firingTriggerId: [ALL_PAGES_TRIGGER],
      },
    });
    log.push(`Tag criada: GA4 ${ga4MeasurementId}`);
  }

  // Cria versão e publica
  const versionResp = await tagManager.accounts.containers.workspaces.create_version({
    path: workspacePath,
    requestBody: {
      name:  `AdAnalyzer v${Date.now()}`,
      notes: "Publicado automaticamente pelo AdAnalyzer",
    },
  });

  const versionPath = versionResp.data.containerVersion?.path;
  if (versionPath) {
    await tagManager.accounts.containers.versions.publish({ path: versionPath });
    log.push("Container publicado com sucesso");
  }

  return { container: containerName, log };
}

// ── Provisiona todos os containers configurados ───────────────

async function provisionAll({ onlyMissing = true } = {}) {
  const containers = await getContainersStatus();
  const results    = [];

  for (const c of containers) {
    if (!c.configured) continue;
    if (onlyMissing && c.hasPixelTag && c.hasGA4Tag) {
      results.push({ container: c.name, skipped: true, reason: "Tags já existem" });
      continue;
    }
    if (!c.pixelId && !c.ga4MeasurementId) {
      results.push({ container: c.name, skipped: true, reason: "Sem pixel ou GA4 configurado" });
      continue;
    }

    try {
      const r = await provisionContainer({
        containerPath:   c.containerPath,
        pixelId:         c.pixelId,
        ga4MeasurementId: c.ga4MeasurementId,
        containerName:   c.name,
      });
      results.push({ ...r, success: true });
    } catch (err) {
      results.push({ container: c.name, success: false, error: err.message });
    }
  }

  return results;
}

module.exports = {
  discoverGA4Streams,
  getContainersStatus,
  provisionContainer,
  provisionAll,
};
