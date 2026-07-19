/**
 * AdAnalyzer — syncKommoData.js
 * Sincroniza leads, contatos e funis do Kommo para o Postgres, diariamente.
 * Idempotente: cada linha é upsert por id, então rodar de novo é seguro.
 *
 * Campos de rastreamento (UTM, gclid, fbclid) extraídos dos custom fields
 * de cada lead, quando presentes — permitem ligar um lead real do CRM à
 * campanha de anúncio que o originou.
 */

const cron = require("node-cron");
const db = require("../services/db");
const kommo = require("../services/kommoClient");

// field_id → coluna, descoberto via /leads/custom_fields na conta real
const TRACKING_FIELD_MAP = {
  347522: "utm_content",
  347524: "utm_medium",
  347526: "utm_campaign",
  347528: "utm_source",
  347530: "utm_term",
  347532: "utm_referrer",
  347534: "referrer",
  347536: "gclientid",
  347538: "gclid",
  347540: "fbclid",
};

function toDate(unixSeconds) {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

function extractTracking(customFieldsValues) {
  const out = {};
  for (const field of customFieldsValues || []) {
    const col = TRACKING_FIELD_MAP[field.field_id];
    if (col) out[col] = field.values?.[0]?.value ?? null;
  }
  return out;
}

function extractContactField(customFieldsValues, fieldCode) {
  const field = (customFieldsValues || []).find((f) => f.field_code === fieldCode);
  return field?.values?.[0]?.value ?? null;
}

async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS kommo_pipelines (
      id BIGINT PRIMARY KEY,
      name TEXT,
      sort INT,
      is_main BOOLEAN,
      synced_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS kommo_pipeline_statuses (
      id BIGINT PRIMARY KEY,
      pipeline_id BIGINT REFERENCES kommo_pipelines(id) ON DELETE CASCADE,
      name TEXT,
      sort INT,
      color TEXT,
      synced_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS kommo_contacts (
      id BIGINT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      synced_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS kommo_leads (
      id BIGINT PRIMARY KEY,
      name TEXT,
      price NUMERIC,
      status_id BIGINT,
      pipeline_id BIGINT,
      main_contact_id BIGINT,
      is_deleted BOOLEAN,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      utm_referrer TEXT,
      referrer TEXT,
      gclientid TEXT,
      gclid TEXT,
      fbclid TEXT,
      synced_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_kommo_leads_pipeline_status ON kommo_leads(pipeline_id, status_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_kommo_leads_created_at ON kommo_leads(created_at);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_kommo_leads_utm_source ON kommo_leads(utm_source);`);
}

async function syncPipelines() {
  const pipelines = await kommo.getPipelines();
  for (const p of pipelines) {
    await db.query(
      `INSERT INTO kommo_pipelines (id, name, sort, is_main)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = $2, sort = $3, is_main = $4, synced_at = now()`,
      [p.id, p.name, p.sort, !!p.is_main]
    );
    for (const s of p._embedded?.statuses || []) {
      await db.query(
        `INSERT INTO kommo_pipeline_statuses (id, pipeline_id, name, sort, color)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = $3, sort = $4, color = $5, synced_at = now()`,
        [s.id, p.id, s.name, s.sort, s.color]
      );
    }
  }
  return pipelines.length;
}

async function syncContacts() {
  const contacts = await kommo.getAllContacts();
  for (const c of contacts) {
    await db.query(
      `INSERT INTO kommo_contacts (id, name, phone, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET name = $2, phone = $3, email = $4, updated_at = $6, synced_at = now()`,
      [
        c.id,
        c.name,
        extractContactField(c.custom_fields_values, "PHONE"),
        extractContactField(c.custom_fields_values, "EMAIL"),
        toDate(c.created_at),
        toDate(c.updated_at),
      ]
    );
  }
  return contacts.length;
}

async function syncLeads() {
  const leads = await kommo.getAllLeads();
  for (const l of leads) {
    const tracking = extractTracking(l.custom_fields_values);
    const mainContact = (l._embedded?.contacts || []).find((c) => c.is_main) || l._embedded?.contacts?.[0];

    await db.query(
      `INSERT INTO kommo_leads (
         id, name, price, status_id, pipeline_id, main_contact_id, is_deleted,
         created_at, updated_at, closed_at,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_referrer,
         referrer, gclientid, gclid, fbclid
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, price = $3, status_id = $4, pipeline_id = $5, main_contact_id = $6, is_deleted = $7,
         updated_at = $9, closed_at = $10,
         utm_source = $11, utm_medium = $12, utm_campaign = $13, utm_content = $14, utm_term = $15,
         utm_referrer = $16, referrer = $17, gclientid = $18, gclid = $19, fbclid = $20,
         synced_at = now()`,
      [
        l.id, l.name, l.price || 0, l.status_id, l.pipeline_id, mainContact?.id || null, !!l.is_deleted,
        toDate(l.created_at), toDate(l.updated_at), toDate(l.closed_at),
        tracking.utm_source || null, tracking.utm_medium || null, tracking.utm_campaign || null,
        tracking.utm_content || null, tracking.utm_term || null, tracking.utm_referrer || null,
        tracking.referrer || null, tracking.gclientid || null, tracking.gclid || null, tracking.fbclid || null,
      ]
    );
  }
  return leads.length;
}

async function runSync() {
  if (!process.env.KOMMO_ACCESS_TOKEN || !process.env.KOMMO_SUBDOMAIN) {
    console.log("[SyncKommo] Desativado (KOMMO_ACCESS_TOKEN/KOMMO_SUBDOMAIN ausentes).");
    return { skipped: true };
  }

  await ensureSchema();

  const pipelines = await syncPipelines();
  const contacts = await syncContacts();
  const leads = await syncLeads();

  console.log(`[SyncKommo] ${pipelines} pipelines, ${contacts} contatos, ${leads} leads sincronizados.`);
  return { pipelines, contacts, leads };
}

function start() {
  if (!process.env.KOMMO_ACCESS_TOKEN || !process.env.KOMMO_SUBDOMAIN) {
    console.log("[SyncKommo] Agendamento desativado (credenciais ausentes).");
    return;
  }
  // 03:45 (horário de Brasília) todo dia — depois do sync de gasto (03:15).
  cron.schedule("45 3 * * *", () => {
    runSync().catch((err) => console.error("[SyncKommo] Erro:", err.message));
  }, { timezone: "America/Sao_Paulo" });

  console.log("[SyncKommo] Agendado para 03:45 (America/Sao_Paulo).");
}

module.exports = { start, runSync };
