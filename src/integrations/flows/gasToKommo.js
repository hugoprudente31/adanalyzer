// Integração: Sistema GAS → Kommo — Óticas Target

const kommo = require("../kommoClient");

function normalizeLoja(loja = "") {
  if (/santos/i.test(loja) || /gonzaga/i.test(loja)) return "Gonzaga & Santos";
  return loja.trim();
}

function buildCustomFields(payload) {
  const fields = [];
  if (payload.loja)             fields.push({ field_code: "LOJA",              values: [{ value: normalizeLoja(payload.loja) }] });
  if (payload.optometrista)     fields.push({ field_code: "OPTOMETRISTA",      values: [{ value: payload.optometrista }] });
  if (payload.data_agendamento) fields.push({ field_code: "DATA_AGENDAMENTO",  values: [{ value: payload.data_agendamento }] });
  if (payload.horario)          fields.push({ field_code: "HORARIO",           values: [{ value: payload.horario }] });
  if (payload.origem)           fields.push({ field_code: "ORIGEM_AGENDAMENTO",values: [{ value: payload.origem }] });
  if (payload.status)           fields.push({ field_code: "STATUS_AGENDAMENTO",values: [{ value: payload.status }] });
  return fields;
}

/**
 * Sincroniza agendamento do GAS para o Kommo.
 * Cria ou atualiza lead e adiciona nota.
 */
async function syncAgendamentoToKommo(payload) {
  console.log(`[GAS→Kommo] Agendamento: ${payload.nome} — ${payload.loja}`);

  // Busca contato existente pelo WhatsApp
  let contato = null;
  if (payload.whatsapp) {
    contato = await kommo.findContact(payload.whatsapp);
  }
  if (!contato && payload.email) {
    contato = await kommo.findContact(payload.email);
  }

  let contactId;
  let leadId = payload.kommo_lead_id || null;
  let action;

  // Cria contato se não existe
  if (!contato) {
    const novoContato = await kommo.createContact({
      nome:     payload.nome,
      whatsapp: payload.whatsapp,
      email:    payload.email,
    });
    contactId = novoContato?.id;
    console.log(`[GAS→Kommo] Contato criado: ${contactId}`);
  } else {
    contactId = contato.id;
    console.log(`[GAS→Kommo] Contato existente: ${contactId}`);
  }

  const customFields = buildCustomFields(payload);

  if (leadId) {
    // Atualiza lead existente
    await kommo.updateLead(leadId, { custom_fields_values: customFields });
    action = "updated";
    console.log(`[GAS→Kommo] Lead atualizado: ${leadId}`);
  } else {
    // Cria novo lead
    const novoLead = await kommo.createLead({
      nome:         `Agendamento — ${payload.nome}`,
      contactId,
      customFields,
    });
    leadId = novoLead?.id;
    action = "created";
    console.log(`[GAS→Kommo] Lead criado: ${leadId}`);
  }

  // Adiciona nota com resumo do agendamento
  const nota = [
    `📅 Agendamento: ${payload.data_agendamento || "-"} às ${payload.horario || "-"}`,
    `🏪 Loja: ${normalizeLoja(payload.loja)}`,
    `👁 Optometrista: ${payload.optometrista || "-"}`,
    `📌 Status: ${payload.status || "-"}`,
    payload.observacao ? `💬 Obs: ${payload.observacao}` : null,
  ].filter(Boolean).join("\n");

  await kommo.addNote(leadId, nota)
    .catch((e) => console.error("[GAS→Kommo] Erro ao adicionar nota:", e.message));

  return { kommo_lead_id: leadId, action };
}

module.exports = { syncAgendamentoToKommo };
