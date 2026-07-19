/**
 * AdAnalyzer — kommoClient.js
 * Cliente somente-leitura da API do Kommo v4 (leads, contatos, funis).
 * Usa https://{subdomain}.kommo.com/api/v4 com Bearer token de longa
 * duração (KOMMO_ACCESS_TOKEN). Sem escrita — não cria nem atualiza nada
 * no Kommo, só lê pra replicar no Postgres.
 */

const BASE = () => {
  const subdomain = process.env.KOMMO_SUBDOMAIN;
  if (!subdomain) throw new Error("KOMMO_SUBDOMAIN não configurado");
  return `https://${subdomain}.kommo.com/api/v4`;
};

async function request(path) {
  const token = process.env.KOMMO_ACCESS_TOKEN;
  if (!token) throw new Error("KOMMO_ACCESS_TOKEN não configurado");

  const res = await fetch(`${BASE()}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (res.status === 204) return null; // Kommo retorna 204 quando a lista está vazia
  const text = await res.text();
  if (!res.ok) throw new Error(`Kommo API ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** Pagina qualquer endpoint de listagem do Kommo até acabar. */
async function paginate(path, embeddedKey, { pageSize = 250, maxPages = 200 } = {}) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await request(`${path}${sep}limit=${pageSize}&page=${page}`);
    const batch = data?._embedded?.[embeddedKey] || [];
    items.push(...batch);
    if (batch.length < pageSize) break; // última página
  }
  return items;
}

async function getAccount() {
  return request("/account");
}

async function getPipelines() {
  const data = await request("/leads/pipelines");
  return data?._embedded?.pipelines || [];
}

async function getLeadCustomFields() {
  const data = await request("/leads/custom_fields?limit=250");
  return Array.isArray(data) ? data : data?._embedded?.custom_fields || [];
}

async function getAllLeads() {
  return paginate("/leads?with=contacts", "leads");
}

async function getAllContacts() {
  return paginate("/contacts", "contacts");
}

module.exports = { getAccount, getPipelines, getLeadCustomFields, getAllLeads, getAllContacts };
