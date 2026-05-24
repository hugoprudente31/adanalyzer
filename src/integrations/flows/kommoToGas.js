// Integração: Kommo → Sistema GAS — Óticas Target

const fetch  = require("node-fetch");
const kommo  = require("../kommoClient");

const GAS_URL     = process.env.GAS_WEBHOOK_URL;
const GAS_API_KEY = process.env.GAS_API_KEY;

// Normaliza nome da loja (Gonzaga e Santos = mesma unidade)
function normalizeLoja(loja = "") {
  if (/santos/i.test(loja) || /gonzaga/i.test(loja)) return "Gonzaga & Santos";
  return loja.trim();
}

/**
 * Recebe evento do Kommo quando lead entra no estágio "Agendar"
 * e cria o agendamento no sistema GAS.
 */
async function triggerAgendamentoFromKommo(payload) {
  // Kommo envia leads com novo status
  const leadEntry = payload?.leads?.status?.[0]
    || payload?.leads?.add?.[0]
    || null;

  if (!leadEntry) {
    console.log("[Kommo→GAS] Payload sem dados de lead, ignorando");
    return { ignored: true };
  }

  const stageAgendar = process.env.KOMMO_STAGE_AGENDAR;
  if (stageAgendar && String(leadEntry.status_id) !== String(stageAgendar)) {
    console.log(`[Kommo→GAS] Estágio ${leadEntry.status_id} não é o de agendamento, ignorando`);
    return { ignored: true, reason: "estágio diferente" };
  }

  const leadId = leadEntry.id;
  console.log(`[Kommo→GAS] Processando lead ${leadId}`);

  // Busca dados completos do lead
  let lead;
  try {
    lead = await kommo.getLead(leadId);
  } catch (err) {
    console.error(`[ERRO][Kommo→GAS] Buscar lead ${leadId}: ${err.message}`);
    return { error: err.message };
  }

  // Extrai dados do contato principal
  const contato = lead?._embedded?.contacts?.[0] || {};
  const campos  = lead?.custom_fields_values || [];

  function getCampo(code) {
    const f = campos.find((c) => c.field_code === code);
    return f?.values?.[0]?.value || "";
  }

  // Monta payload para o GAS
  const agendamento = {
    action:          "salvarAgendamento",
    key:             GAS_API_KEY,
    nome:            contato.name || lead.name || "Sem nome",
    whatsapp:        getCampo("PHONE") || "",
    email:           getCampo("EMAIL") || "",
    loja:            normalizeLoja(getCampo("LOJA")),
    optometrista:    getCampo("OPTOMETRISTA") || "",
    data_agendamento: getCampo("DATA_AGENDAMENTO") || "",
    horario:         getCampo("HORARIO") || "",
    origem:          "Kommo",
    observacao:      `Lead Kommo #${leadId}`,
    status:          "Agendado",
    kommo_lead_id:   String(leadId),
  };

  console.log(`[Kommo→GAS] Enviando agendamento para GAS:`, agendamento.nome, agendamento.loja);

  // Chama o GAS
  try {
    const gasRes = await fetch(GAS_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(agendamento),
      timeout: 30000,
    });
    const gasData = await gasRes.json();
    console.log("[Kommo→GAS] GAS respondeu:", JSON.stringify(gasData).slice(0, 200));

    // Registra nota no lead do Kommo
    await kommo.addNote(leadId,
      `✅ Agendamento criado no sistema\n📅 ${agendamento.data_agendamento} às ${agendamento.horario}\n🏪 ${agendamento.loja}\n👁 ${agendamento.optometrista}`
    ).catch((e) => console.error("[Kommo→GAS] Erro ao adicionar nota:", e.message));

    return { success: true, leadId, gasResponse: gasData };
  } catch (err) {
    console.error(`[ERRO][Kommo→GAS] Chamar GAS: ${err.message}`);
    await kommo.addNote(leadId, `⚠️ Erro ao criar agendamento no sistema: ${err.message}`)
      .catch(() => {});
    return { error: err.message };
  }
}

module.exports = { triggerAgendamentoFromKommo };
