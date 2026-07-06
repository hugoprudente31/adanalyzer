/**
 * AdAnalyzer — diagKondado.js
 * Endpoint TEMPORÁRIO de diagnóstico: testa se este servidor (rodando no
 * Railway, com internet normal) consegue alcançar a API do Kondado — de um
 * ambiente de desenvolvimento local isolado essa chamada travou (timeout de
 * rede), então este endpoint existe só para confirmar se o problema é da
 * infraestrutura do Kondado ou daquele ambiente específico.
 *
 * Remover depois que o diagnóstico for concluído.
 */

const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

router.get("/diag/kondado", async (req, res) => {
  const diagKey = process.env.DIAG_KEY;
  if (!diagKey) {
    return res.status(500).json({ ok: false, message: "DIAG_KEY não configurada no Railway." });
  }
  if (req.query.key !== diagKey) {
    return res.status(403).json({ ok: false, message: "Chave de diagnóstico inválida." });
  }

  const kondadoKey = process.env.KONDADO_API_KEY;
  if (!kondadoKey) {
    return res.status(500).json({ ok: false, message: "KONDADO_API_KEY não configurada no Railway." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const inicio = Date.now();

  try {
    const r = await fetch("https://api.kondado.com.br/v1/leads?limit=1", {
      headers: { Authorization: `Bearer ${kondadoKey}`, Accept: "application/json" },
      signal: controller.signal,
    });
    const tempoMs = Date.now() - inicio;
    const texto = await r.text();

    res.json({
      ok: true,
      alcancou: true,
      httpStatus: r.status,
      tempoMs,
      corpoResumo: texto.slice(0, 500),
    });
  } catch (err) {
    const tempoMs = Date.now() - inicio;
    res.json({
      ok: true,
      alcancou: false,
      erro: err.name === "AbortError" ? "Timeout — sem resposta em 8s" : err.message,
      tempoMs,
    });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;
