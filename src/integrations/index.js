// Integração: Hub Central — Óticas Target

const express = require("express");
const router  = express.Router();

const { syncAgendamentoToKommo }    = require("./flows/gasToKommo");
const { triggerAgendamentoFromKommo } = require("./flows/kommoToGas");
const { requireWebhookSecret } = require("../middleware/security");

// GET /api/integration/health
router.get("/integration/health", (req, res) => {
  res.json({
    status:    "ok",
    service:   "Hub Integração — Óticas Target",
    kommo:     !!process.env.KOMMO_ACCESS_TOKEN,
    gas:       !!process.env.GAS_WEBHOOK_URL,
    timestamp: new Date().toISOString(),
  });
});

// POST /api/webhook/kommo — recebe eventos do Kommo (inbox, pipeline, etc.)
router.post("/webhook/kommo", requireWebhookSecret, async (req, res) => {
  // Sempre responde 200 para o Kommo não parar de enviar
  res.status(200).json({ received: true });

  const payload = req.body;
  console.log("[Webhook/Kommo] Evento recebido:", JSON.stringify(payload).slice(0, 300));

  try {
    const result = await triggerAgendamentoFromKommo(payload);
    console.log("[Webhook/Kommo] Resultado:", JSON.stringify(result).slice(0, 200));
  } catch (err) {
    console.error("[ERRO][Webhook/Kommo]", err.message);
  }
});

// POST /api/webhook/gas — recebe eventos do sistema de agendamento
router.post("/webhook/gas", requireWebhookSecret, async (req, res) => {
  res.status(200).json({ received: true });

  const payload = req.body;
  console.log("[Webhook/GAS] Evento recebido:", payload?.event, payload?.nome);

  try {
    if (payload?.event === "novo_agendamento" || payload?.nome) {
      const result = await syncAgendamentoToKommo(payload);
      console.log("[Webhook/GAS] Sincronizado com Kommo:", JSON.stringify(result));
    } else {
      console.log("[Webhook/GAS] Evento não mapeado:", payload?.event);
    }
  } catch (err) {
    console.error("[ERRO][Webhook/GAS]", err.message);
  }
});

module.exports = router;
