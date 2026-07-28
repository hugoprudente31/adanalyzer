/**
 * AdAnalyzer — syncFinanceiro.js
 * Sincroniza dados reais de venda do "sistema de agendamento" (projeto
 * Railway separado) para o Postgres do próprio adanalyzer, diariamente.
 *
 * A tabela `faturamentos` desse outro sistema existe mas está vazia (só um
 * registro de teste) — o dado real de venda vive misturado na tabela
 * `agendamentos` (campo valor_venda), junto com os campos de agendamento.
 * Por isso este job lê só as colunas financeiro-relevantes de lá.
 *
 * Não existe campo de forma/status de pagamento no dado real — isso dá pra
 * Receita, não pra fluxo de caixa/conciliação de pagamento (ver README.md
 * de services/financeiro para o que fica de fora por causa disso).
 */

const cron = require("node-cron");
const { Client } = require("pg");
const db = require("../services/db");
const { bulkUpsert } = require("../utils/pgBulkUpsert");

const COLS = [
  "id", "cliente_nome", "loja", "vendedor_nome", "consultor_responsavel",
  "valor_venda", "desconto", "motivo_perda", "status_os", "numero_os",
  "status", "compareceu",
  "data_agendamento", "data_abertura_os", "data_entrada_os", "data_finalizacao_os", "data_entrega_os",
  "kommo_lead_id", "criado_em", "atualizado_em",
];
const UPDATE_COLS = COLS.filter((c) => c !== "id" && c !== "criado_em");

async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS financeiro_vendas (
      id                    INTEGER PRIMARY KEY,
      cliente_nome          TEXT,
      loja                  TEXT,
      vendedor_nome         TEXT,
      consultor_responsavel TEXT,
      valor_venda           NUMERIC,
      desconto              NUMERIC,
      motivo_perda          TEXT,
      status_os             TEXT,
      numero_os             TEXT,
      status                TEXT,
      compareceu            TEXT,
      data_agendamento      DATE,
      data_abertura_os      DATE,
      data_entrada_os       DATE,
      data_finalizacao_os   DATE,
      data_entrega_os       DATE,
      kommo_lead_id         TEXT,
      criado_em             TIMESTAMP,
      atualizado_em         TIMESTAMP,
      synced_at             TIMESTAMPTZ DEFAULT now()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_financeiro_vendas_loja ON financeiro_vendas(loja);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_financeiro_vendas_data ON financeiro_vendas(data_agendamento);`);
}

/**
 * Conexão avulsa (não pool) pra origem — roda uma vez por dia + gatilho
 * manual ocasional, não precisa ficar com conexão aberta o dia inteiro
 * num banco de outro projeto Railway.
 */
async function fetchFromSistema() {
  if (!process.env.SISTEMA_DATABASE_URL) {
    throw new Error("SISTEMA_DATABASE_URL não configurado.");
  }
  const client = new Client({
    connectionString: process.env.SISTEMA_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        id, nome AS cliente_nome, loja, vendedor_nome, consultor_responsavel,
        valor_venda, desconto, motivo_perda, status_os, numero_os, status, compareceu,
        data_agendamento, data_abertura_os, data_entrada_os, data_finalizacao_os, data_entrega_os,
        kommo_lead_id, criado_em, atualizado_em
      FROM agendamentos
      WHERE excluido_em IS NULL
    `);
    return rows;
  } finally {
    await client.end();
  }
}

async function syncVendas() {
  const startedAt = new Date();
  const source = await fetchFromSistema();

  const rows = source.map((r) => COLS.map((c) => r[c] ?? null));
  const total = await bulkUpsert("financeiro_vendas", COLS, "id", UPDATE_COLS, rows);

  // Remove localmente o que não veio nesta rodada (agendamento excluído/soft-deleted na origem).
  const { rowCount: removidos } = await db.query(
    `DELETE FROM financeiro_vendas WHERE synced_at < $1`,
    [startedAt]
  );

  return { total, removidos };
}

async function runSync() {
  if (!process.env.SISTEMA_DATABASE_URL) {
    console.log("[SyncFinanceiro] Desativado (SISTEMA_DATABASE_URL ausente).");
    return { skipped: true };
  }

  await ensureSchema();
  const { total, removidos } = await syncVendas();

  console.log(`[SyncFinanceiro] ${total} vendas sincronizadas, ${removidos} removidas (não estavam mais na origem).`);
  return { total, removidos };
}

function start() {
  if (!process.env.SISTEMA_DATABASE_URL) {
    console.log("[SyncFinanceiro] Agendamento desativado (SISTEMA_DATABASE_URL ausente).");
    return;
  }
  // 04:15 (horário de Brasília) todo dia — depois do sync do Kommo (03:45).
  cron.schedule("15 4 * * *", () => {
    runSync().catch((err) => console.error("[SyncFinanceiro] Erro:", err.message));
  }, { timezone: "America/Sao_Paulo" });

  console.log("[SyncFinanceiro] Agendado para 04:15 (America/Sao_Paulo).");
}

module.exports = { start, runSync };
