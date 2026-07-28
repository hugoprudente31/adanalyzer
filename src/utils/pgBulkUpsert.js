/**
 * AdAnalyzer — pgBulkUpsert.js
 * Extraído de src/jobs/syncKommoData.js (sem mudar comportamento) — passou a
 * ser usado por mais de um job de sync (Kommo, Financeiro), então virou util
 * compartilhado.
 *
 * Sempre escreve no Postgres do PRÓPRIO adanalyzer (via src/services/db.js),
 * mesmo quando a origem dos dados é outro banco — quem lê a origem usa sua
 * própria conexão, separada.
 */

const db = require("../services/db");

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Monta um INSERT multi-linha: coloca N linhas de `cols.length` valores cada
// numa única query, em vez de N round-trips separados ao Postgres. Corrigido
// nesta sessão depois de um bug real: upserts um-a-um (~34 mil round-trips
// pro sync do Kommo) derrubavam a conexão no meio do caminho.
async function bulkUpsert(table, cols, conflictCol, updateCols, rows, batchSize = 500) {
  let total = 0;
  for (const batch of chunk(rows, batchSize)) {
    const values = [];
    const placeholders = batch.map((row, i) => {
      const base = i * cols.length;
      values.push(...row);
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(",")})`;
    });
    const setClause = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
    await db.query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${placeholders.join(",")}
       ON CONFLICT (${conflictCol}) DO UPDATE SET ${setClause}, synced_at = now()`,
      values
    );
    total += batch.length;
  }
  return total;
}

module.exports = { bulkUpsert, chunk };
