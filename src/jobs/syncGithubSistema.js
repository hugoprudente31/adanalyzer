/**
 * AdAnalyzer — syncGithubSistema.js
 * Envia (push) diariamente o gasto de anúncios Meta por loja para o
 * github-sistema (fonte única de verdade do banco de dados). O AdAnalyzer
 * não guarda nenhum dado — apenas calcula e envia via HTTP autenticado.
 */

const cron = require("node-cron");
const fetch = require("node-fetch");
const metaAds = require("../services/metaAds");
const { getStoreRanking } = require("../modules/storeConsolidation");
const { toCanonicalStore, SEM_LOJA_UNICA } = require("../config/storeAliasMap");

function yesterdayInSaoPaulo() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0, 10);
}

async function buildPayload(dateRef) {
  const campaigns = await metaAds.getInsights({ dateRange: { since: dateRef, until: dateRef }, level: "campaign" });
  const ranking = getStoreRanking(campaigns);

  const rows = [];
  for (const entry of ranking) {
    const { store, totals } = entry;
    const canonico = toCanonicalStore(store);
    if (!canonico && !SEM_LOJA_UNICA.includes(store)) continue;

    rows.push({
      loja: canonico, // null para "Multi Lojas"/"Outros" — gasto mostrado à parte, fora do ROAS por loja
      categoria: canonico ? null : store,
      data_referencia: dateRef,
      plataforma: "meta",
      spend: totals.spend,
      impressions: totals.impressions,
      clicks: totals.clicks,
      actions: totals.actions,
      ctr: totals.ctr,
      cpc: totals.cpc,
      cpa: totals.cpa,
    });
  }
  return rows;
}

async function runSync(dateRef = yesterdayInSaoPaulo()) {
  const apiUrl = process.env.GITHUB_SISTEMA_API_URL;
  const syncKey = process.env.ADANALYZER_SYNC_KEY;
  if (!apiUrl || !syncKey) {
    throw new Error("GITHUB_SISTEMA_API_URL ou ADANALYZER_SYNC_KEY não configurados");
  }

  const rows = await buildPayload(dateRef);
  if (!rows.length) {
    console.log(`[SyncGithubSistema] Nenhum gasto encontrado para ${dateRef}, nada a enviar.`);
    return { sent: 0, dateRef };
  }

  const res = await fetch(`${apiUrl}/api/admin/ads-performance/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": syncKey },
    body: JSON.stringify({ rows }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(`Falha ao enviar para github-sistema: HTTP ${res.status} — ${body.error || "sem detalhe"}`);
  }

  console.log(`[SyncGithubSistema] Enviado ${rows.length} linha(s) para ${dateRef}.`);
  return { sent: rows.length, dateRef };
}

function start() {
  if (!process.env.ADANALYZER_SYNC_KEY || !process.env.GITHUB_SISTEMA_API_URL) {
    console.log("[SyncGithubSistema] Desativado (ADANALYZER_SYNC_KEY/GITHUB_SISTEMA_API_URL ausentes).");
    return;
  }

  // 03:15 (horário de Brasília) todo dia, depois que os dados do dia anterior já assentaram na Meta.
  cron.schedule("15 3 * * *", () => {
    runSync().catch((err) => console.error("[SyncGithubSistema] Erro:", err.message));
  }, { timezone: "America/Sao_Paulo" });

  console.log("[SyncGithubSistema] Agendado para 03:15 (America/Sao_Paulo).");
}

module.exports = { start, runSync, buildPayload };
