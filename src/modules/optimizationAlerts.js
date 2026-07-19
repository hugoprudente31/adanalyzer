/**
 * AdAnalyzer — optimizationAlerts.js
 * Alertas automáticos + insights Claude AI baseados em performance real.
 */

const { generateReport } = require("./performanceReport");
const kommoDb = require("../services/kommoDb.service");
const fetch = require("node-fetch");

const ALERT_RULES = [
  {
    id: "high_cpc",
    check: (s) => s.metrics.cpc.value > 2.00 && s.metrics.spend.value > 100,
    severity: "warning",
    title: (s) => `CPC alto em ${s.store}`,
    description: (s) => `CPC de ${s.metrics.cpc.formatted} acima do ideal (>R$2,00) com ${s.metrics.spend.formatted} investidos.`,
    action: "Revisar segmentação e criativos.",
  },
  {
    id: "low_ctr",
    check: (s) => s.metrics.ctr.value < 0.3 && s.metrics.spend.value > 150,
    severity: "critical",
    title: (s) => `CTR crítico em ${s.store}`,
    description: (s) => `CTR de ${s.metrics.ctr.formatted} muito abaixo do esperado com ${s.metrics.spend.formatted} gastos.`,
    action: "Pausar e revisar criativos com urgência.",
  },
  {
    id: "excellent_ctr",
    check: (s) => s.metrics.ctr.value >= 5.0,
    severity: "success",
    title: (s) => `Escalar ${s.store}`,
    description: (s) => `CTR excepcional de ${s.metrics.ctr.formatted}. Acima da média.`,
    action: "Aumentar orçamento diário em 2x.",
  },
  {
    id: "low_spend_high_actions",
    check: (s) => s.metrics.actions.value > 5000 && s.metrics.spend.value < 500,
    severity: "info",
    title: (s) => `Sub-investimento em ${s.store}`,
    description: (s) => `${s.metrics.actions.formatted} ações com apenas ${s.metrics.spend.formatted}. Potencial não explorado.`,
    action: "Aumentar orçamento gradualmente.",
  },
  {
    id: "excellent_cpa",
    check: (s) => s.metrics.cpa.value > 0 && s.metrics.cpa.value < 0.05,
    severity: "success",
    title: (s) => `CPA excelente em ${s.store}`,
    description: (s) => `Custo por ação de ${s.metrics.cpa.formatted} — muito eficiente.`,
    action: "Manter e monitorar.",
  },
];

function generateRuleAlerts(report) {
  const alerts = [];
  for (const store of report.stores) {
    for (const rule of ALERT_RULES) {
      if (rule.check(store)) {
        alerts.push({
          id:          `${rule.id}_${store.store}`,
          store:       store.store,
          color:       store.color,
          severity:    rule.severity,
          title:       rule.title(store),
          description: rule.description(store),
          action:      rule.action,
          generatedAt: new Date().toISOString(),
        });
      }
    }
  }
  const order = { critical: 0, warning: 1, info: 2, success: 3 };
  return alerts.sort((a, b) => (order[a.severity] || 9) - (order[b.severity] || 9));
}

async function generateAIInsights(report) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const storesSummary = report.stores.map((s) =>
    `- ${s.store}: R$${s.metrics.spend.value} gasto, ${s.metrics.actions.value} ações, CTR ${s.metrics.ctr.formatted}, CPC ${s.metrics.cpc.formatted}`
  ).join("\n");

  let funnelSummary = "";
  try {
    const funnel = await kommoDb.getFunnelSummary();
    if (funnel.length > 0) {
      funnelSummary = "\n\nFUNIL DE VENDAS REAL (Kommo CRM, todos os períodos):\n" +
        funnel.map((f) => `- ${f.pipeline} → ${f.status}: ${f.leads} leads, R$${f.totalPrice.toFixed(2)} em negociação`).join("\n");
    }
  } catch (err) {
    console.warn("[Alerts] Kommo indisponível para o prompt de IA:", err.message);
  }

  const prompt = `Você é especialista em tráfego pago para óticas. Analise os dados e retorne JSON válido sem markdown.

DADOS DE ANÚNCIOS (últimos 30 dias):
${storesSummary}
Total: R$${report.grandTotal.spend} gasto, CTR ${report.grandTotal.ctr}%, CPC R$${report.grandTotal.cpc}
${funnelSummary}

Cruze o gasto de anúncio com o funil de vendas real quando possível — não julgue uma loja só pelo CTR/CPC, considere quantos leads realmente avançaram no funil.

Retorne SOMENTE este JSON:
{
  "summary": "resumo executivo em 2 frases",
  "highlight": "melhor loja e por quê",
  "concern": "maior preocupação",
  "recommendations": [
    { "store": "loja", "action": "ação específica", "priority": "high|medium|low", "expectedImpact": "impacto esperado" }
  ],
  "budgetSuggestion": "sugestão de realocação em 1 frase"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-5",
        max_tokens: 800,
        messages:   [{ role: "user", content: prompt }],
      }),
      timeout: 30000,
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { summary: text, recommendations: [] };
  } catch (err) {
    console.error("[Alerts] Erro IA:", err.message);
    return null;
  }
}

async function runAlerts(campaigns, previousCampaigns = [], options = {}) {
  const report     = generateReport(campaigns, previousCampaigns);
  const ruleAlerts = generateRuleAlerts(report);
  const aiInsights = options.enableAI === true ? await generateAIInsights(report) : null;

  return {
    report,
    alerts:     ruleAlerts,
    aiEnabled:  options.enableAI === true,
    aiInsights: aiInsights || { summary: "Análise indisponível.", recommendations: [] },
    summary: {
      critical: ruleAlerts.filter((a) => a.severity === "critical").length,
      warning:  ruleAlerts.filter((a) => a.severity === "warning").length,
      success:  ruleAlerts.filter((a) => a.severity === "success").length,
      info:     ruleAlerts.filter((a) => a.severity === "info").length,
    },
  };
}

module.exports = { runAlerts, generateRuleAlerts, generateAIInsights, ALERT_RULES };
