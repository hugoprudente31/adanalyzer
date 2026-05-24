// Integração: Kommo CRM — Óticas Target

const fetch = require("node-fetch");

class KommoClient {
  constructor() {
    this.accessToken = process.env.KOMMO_ACCESS_TOKEN;
    this.subdomain   = process.env.KOMMO_SUBDOMAIN;
    this.baseUrl     = `https://${this.subdomain}.kommo.com/api/v4`;
  }

  async request(method, path, body = null) {
    if (!this.accessToken || !this.subdomain) {
      throw new Error("KOMMO_ACCESS_TOKEN ou KOMMO_SUBDOMAIN não configurado");
    }

    const opts = {
      method,
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type":  "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res  = await fetch(`${this.baseUrl}${path}`, opts);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Kommo API ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }

  // Busca contato por telefone/email
  async findContact(query) {
    console.log(`[KommoClient] findContact: ${query}`);
    try {
      const data = await this.request("GET", `/contacts?query=${encodeURIComponent(query)}`);
      return data?._embedded?.contacts?.[0] || null;
    } catch {
      return null;
    }
  }

  // Busca lead pelo ID
  async getLead(leadId) {
    console.log(`[KommoClient] getLead: ${leadId}`);
    return this.request("GET", `/leads/${leadId}?with=contacts`);
  }

  // Cria contato
  async createContact({ nome, whatsapp, email }) {
    console.log(`[KommoClient] createContact: ${nome}`);
    const body = [{
      name: nome,
      custom_fields_values: [
        whatsapp && { field_code: "PHONE", values: [{ value: whatsapp, enum_code: "WORK" }] },
        email    && { field_code: "EMAIL", values: [{ value: email,    enum_code: "WORK" }] },
      ].filter(Boolean),
    }];
    const data = await this.request("POST", "/contacts", body);
    return data?._embedded?.contacts?.[0];
  }

  // Cria lead vinculado a um contato
  async createLead({ nome, contactId, stageId, customFields = [] }) {
    console.log(`[KommoClient] createLead: ${nome}`);
    const body = [{
      name:      nome,
      status_id: stageId ? Number(stageId) : undefined,
      _embedded: { contacts: [{ id: contactId }] },
      custom_fields_values: customFields,
    }];
    const data = await this.request("POST", "/leads", body);
    return data?._embedded?.leads?.[0];
  }

  // Atualiza lead existente
  async updateLead(leadId, fields = {}) {
    console.log(`[KommoClient] updateLead: ${leadId}`);
    return this.request("PATCH", `/leads/${leadId}`, fields);
  }

  // Adiciona nota de texto no lead
  async addNote(leadId, text) {
    console.log(`[KommoClient] addNote: lead ${leadId}`);
    const body = [{
      entity_id:  Number(leadId),
      note_type:  "common",
      params:     { text },
    }];
    return this.request("POST", "/leads/notes", body);
  }

  // Configura webhook no Kommo
  async registerWebhook(url, events) {
    console.log(`[KommoClient] registerWebhook: ${url}`);
    return this.request("POST", "/webhooks", { destination: url, settings: events });
  }
}

module.exports = new KommoClient();
