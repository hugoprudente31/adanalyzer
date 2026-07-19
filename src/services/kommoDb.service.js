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

// Convenção real observada nos nomes dos estágios desta conta Kommo
// (não existe um campo booleano "ganho/perdido" confiável — os 4 funis
// usam nomes como "Venda ganha", "Venda perdida", "Venda Fechada").
const WON_PATTERN  = /ganh|fechad/i;
const LOST_PATTERN = /perdid/i;

/** Os 4 funis reais (um por loja) com seus estágios, na ordem configurada no Kommo. */
async function getPipelinesWithStages() {
  if (!(await db.tableExists("kommo_pipelines"))) return [];

  const { rows: pipelines } = await db.query(
    `SELECT id, name, sort FROM kommo_pipelines ORDER BY sort`
  );
  const { rows: statuses } = await db.query(
    `SELECT id, pipeline_id, name, sort, color FROM kommo_pipeline_statuses ORDER BY pipeline_id, sort`
  );

  return pipelines.map((p) => ({
    id: p.id,
    name: p.name,
    statuses: statuses
      .filter((s) => s.pipeline_id === p.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        isWon: WON_PATTERN.test(s.name),
        isLost: LOST_PATTERN.test(s.name),
      })),
  }));
}

/**
 * Quadro Kanban de um funil: para cada estágio, total/contagem real e uma
 * amostra dos leads mais recentes (a lista completa pode ter milhares de
 * linhas, então o quadro mostra só os mais relevantes por estágio).
 */
async function getPipelineBoard(pipelineId, { sampleSize = 25 } = {}) {
  if (!(await db.tableExists("kommo_leads"))) return null;

  const { rows: totals } = await db.query(
    `
    SELECT status_id, COUNT(*) AS leads, SUM(price) AS total_price
    FROM kommo_leads
    WHERE pipeline_id = $1 AND is_deleted = false
    GROUP BY status_id
    `,
    [pipelineId]
  );

  const { rows: sample } = await db.query(
    `
    SELECT l.id, l.name, l.price, l.status_id, l.created_at, l.updated_at, l.closed_at,
           c.name AS contact_name, c.phone AS contact_phone
    FROM kommo_leads l
    LEFT JOIN kommo_contacts c ON c.id = l.main_contact_id
    WHERE l.pipeline_id = $1 AND l.is_deleted = false
    ORDER BY l.updated_at DESC
    LIMIT 400
    `,
    [pipelineId]
  );

  const byStatus = {};
  for (const row of sample) {
    (byStatus[row.status_id] ||= []).push({
      id: row.id,
      name: row.contact_name || row.name,
      phone: row.contact_phone,
      price: Number(row.price) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
    });
  }
  for (const statusId of Object.keys(byStatus)) {
    byStatus[statusId] = byStatus[statusId].slice(0, sampleSize);
  }

  const totalsByStatus = {};
  for (const t of totals) {
    totalsByStatus[t.status_id] = { leads: Number(t.leads), totalPrice: Number(t.total_price) || 0 };
  }

  return { totalsByStatus, leadsByStatus: byStatus };
}

/**
 * KPIs do topo do dashboard. "Quentes"/"Em risco" são heurísticas sobre
 * recência real (updated_at), já que não existe pontuação de engajamento
 * de verdade nos dados do Kommo — não confundir com dado fabricado.
 */
async function getDashboardSummary() {
  if (!(await db.tableExists("kommo_leads"))) {
    return { activePipelineValue: 0, activeDeals: 0, wonRevenue: 0, wonDeals: 0, hotLeads: 0, atRiskLeads: 0 };
  }

  const { rows } = await db.query(`
    SELECT s.name AS status_name, l.price, l.updated_at
    FROM kommo_leads l
    LEFT JOIN kommo_pipeline_statuses s ON s.id = l.status_id
    WHERE l.is_deleted = false
  `);

  let activePipelineValue = 0, activeDeals = 0, wonRevenue = 0, wonDeals = 0, hotLeads = 0, atRiskLeads = 0;
  const now = Date.now();
  const THREE_DAYS = 3 * 86400000, FOURTEEN_DAYS = 14 * 86400000;

  for (const r of rows) {
    const name = r.status_name || "";
    const price = Number(r.price) || 0;
    const ageMs = r.updated_at ? now - new Date(r.updated_at).getTime() : Infinity;

    if (WON_PATTERN.test(name)) {
      wonRevenue += price; wonDeals++;
    } else if (!LOST_PATTERN.test(name)) {
      activePipelineValue += price; activeDeals++;
      if (ageMs <= THREE_DAYS) hotLeads++;
      if (ageMs > FOURTEEN_DAYS) atRiskLeads++;
    }
  }

  return { activePipelineValue, activeDeals, wonRevenue, wonDeals, hotLeads, atRiskLeads };
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

module.exports = {
  getFunnelSummary, getLeadsByUtmSource, getSyncStatus,
  getPipelinesWithStages, getPipelineBoard, getDashboardSummary,
};
