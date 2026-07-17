/**
 * AdAnalyzer — db.js
 * Pool de conexão compartilhado com o Postgres que recebe os dados
 * replicados pelo Kondado (Google Ads, GA4, Search Console, Meta Ads).
 */

const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurado");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function tableExists(tableName) {
  const { rows } = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return rows.length > 0;
}

module.exports = { query, getPool, tableExists };
