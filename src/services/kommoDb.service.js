/**
 * AdAnalyzer — kommoDb.service.js
 * Leitura dos dados do Kommo já replicados no Postgres (ver syncKommoData.js).
 */

const db = require("./db");

async function getFunnelSummary({ since, until } = {}) {
  if (!(await db.tableExists("kommo_leads"))) return [];

  const params = [];
  let where = "1=1";
  if (since && until) { params.push(since, until); where = `l.created_at BETWEEN $1 AND $2`; }

  const { rows } = await db.query(
    `
    SELECT
      p.name AS pipeline_name,
      s.name AS status_name,
      COUNT(*) AS leads,
      SUM(l.price) AS total_price
    FROM kommo_leads l
    LEFT JOIN kommo_pipelines p ON p.id = l.pipeline_id
    LEFT JOIN kommo_pipeline_statuses s ON s.id = l.status_id
    WHERE ${where} AND l.is_deleted = false
    GROUP BY p.name, s.name
    ORDER BY p.name, leads DESC
    `,
    params
  );
  return rows.map((r) => ({
    pipeline: r.pipeline_name,
    status: r.status_name,
    leads: Number(r.leads),
    totalPrice: Number(r.total_price) || 0,
  }));
}

async function getLeadsByUtmSource({ since, until } = {}) {
  if (!(await db.tableExists("kommo_leads"))) return [];

  const params = [];
  let where = "l.utm_source IS NOT NULL";
  if (since && until) { params.push(since, until); where += ` AND l.created_at BETWEEN $1 AND $2`; }

  const { rows } = await db.query(
    `
    SELECT l.utm_source, l.utm_campaign, COUNT(*) AS leads, SUM(l.price) AS total_price
    FROM kommo_leads l
    WHERE ${where} AND l.is_deleted = false
    GROUP BY l.utm_source, l.utm_campaign
    ORDER BY leads DESC
    `,
    params
  );
  return rows.map((r) => ({
    utmSource: r.utm_source,
    utmCampaign: r.utm_campaign,
    leads: Number(r.leads),
    totalPrice: Number(r.total_price) || 0,
  }));
}

async function getSyncStatus() {
  if (!(await db.tableExists("kommo_leads"))) {
    return { synced: false, leads: 0, contacts: 0, lastSyncAt: null };
  }
  const { rows: [leadRow] }    = await db.query(`SELECT COUNT(*) AS n, MAX(synced_at) AS last FROM kommo_leads`);
  const { rows: [contactRow] } = await db.query(`SELECT COUNT(*) AS n FROM kommo_contacts`);
  return {
    synced: true,
    leads: Number(leadRow.n),
    contacts: Number(contactRow.n),
    lastSyncAt: leadRow.last,
  };
}

module.exports = { getFunnelSummary, getLeadsByUtmSource, getSyncStatus };
