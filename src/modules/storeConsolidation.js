/**
 * AdAnalyzer — storeConsolidation.js
 * Consolida campanhas por loja via padrão de nome.
 * Adicionar nova loja: incluir entrada em CAMPAIGN_STORE_PATTERNS.
 */

const CAMPAIGN_STORE_PATTERNS = [
  // Lojas específicas (ordem importa — mais específico primeiro)
  { pattern: /gonzaga/i,           store: "Gonzaga/Santos" },
  { pattern: /santos/i,            store: "Gonzaga/Santos" },
  { pattern: /enseada/i,           store: "Enseada" },
  { pattern: /pitangueiras?/i,     store: "Pitangueiras" },  // grafia correta
  { pattern: /pintagueiras?/i,     store: "Pitangueiras" },  // typo comum nas campanhas
  { pattern: /\bpita\b/i,          store: "Pitangueiras" },
  { pattern: /\btarget\b/i,        store: "Target" },
  // Campanhas gerais / multi-lojas
  { pattern: /multi.?lojas?/i,     store: "Multi Lojas" },
  { pattern: /familia/i,           store: "Multi Lojas" },
  { pattern: /olhar.+saud/i,       store: "Multi Lojas" },
  { pattern: /oculos.+sol/i,       store: "Multi Lojas" },
  { pattern: /conj/i,              store: "Multi Lojas" },  // CONJ-06-AN- T.VISÃO+ARMAÇÃO
  { pattern: /vis[aã]o/i,          store: "Multi Lojas" },
  { pattern: /armac[aã]o/i,        store: "Multi Lojas" },
  { pattern: /instucional/i,       store: "Multi Lojas" },  // GABI-VIDEO-INSTUCIONAL
  { pattern: /institucional/i,     store: "Multi Lojas" },
  { pattern: /gabi/i,              store: "Multi Lojas" },
  { pattern: /tgt/i,               store: "Multi Lojas" },
  { pattern: /otica/i,             store: "Multi Lojas" },
  { pattern: /promo/i,             store: "Multi Lojas" },
];

const STORE_COLORS = {
  "Gonzaga/Santos": "#378ADD",
  "Enseada":        "#1D9E75",
  "Pitangueiras":   "#D85A30",
  "Target":         "#BA7517",
  "Multi Lojas":    "#7F77DD",
  "Outros":         "#999999",
};

const STORE_WHATSAPP = {
  "Gonzaga/Santos": "https://wa.me/5513996453111",
  "Enseada":        "https://wa.me/5513997214862",
  "Pitangueiras":   "https://wa.me/5513997040234",
  "Target":         "https://wa.me/5513997856493",
};

function resolveStore(campaignName = "") {
  for (const { pattern, store } of CAMPAIGN_STORE_PATTERNS) {
    if (pattern.test(campaignName)) return store;
  }
  return "Outros";
}

/**
 * Soma o campo actions que vem como array da Meta API
 * [{ action_type: "link_click", value: "123" }, ...]
 */
function sumActions(actionsArr) {
  if (!actionsArr || !Array.isArray(actionsArr)) return 0;
  // Prioriza post_engagement ou link_click como "ações"
  const priority = ["post_engagement", "link_click", "page_engagement"];
  for (const type of priority) {
    const found = actionsArr.find((a) => a.action_type === type);
    if (found) return Number(found.value) || 0;
  }
  // Fallback: soma tudo
  return actionsArr.reduce((s, a) => s + (Number(a.value) || 0), 0);
}

function groupByStore(campaigns) {
  const grouped = {};

  for (const campaign of campaigns) {
    const name  = campaign.campaign_name || campaign.name || "";
    const store = resolveStore(name);

    if (!grouped[store]) {
      grouped[store] = {
        store,
        color:     STORE_COLORS[store] || "#999999",
        whatsapp:  STORE_WHATSAPP[store] || null,
        campaigns: [],
        totals:    { spend: 0, impressions: 0, clicks: 0, actions: 0 },
      };
    }

    grouped[store].campaigns.push(campaign);

    const t = grouped[store].totals;
    t.spend       += Number(campaign.spend       || 0);
    t.impressions += Number(campaign.impressions || 0);
    t.clicks      += Number(campaign.clicks      || 0);
    t.actions     += sumActions(campaign.actions);
  }

  for (const s of Object.values(grouped)) {
    const { spend, impressions, clicks, actions } = s.totals;
    s.totals.ctr   = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0;
    s.totals.cpc   = clicks > 0     ? parseFloat((spend / clicks).toFixed(2))                : 0;
    s.totals.cpa   = actions > 0    ? parseFloat((spend / actions).toFixed(4))               : 0;
    s.totals.spend = parseFloat(spend.toFixed(2));
  }

  return grouped;
}

function getStoreRanking(campaigns) {
  return Object.values(groupByStore(campaigns))
    .sort((a, b) => b.totals.spend - a.totals.spend);
}

module.exports = { resolveStore, groupByStore, getStoreRanking, STORE_COLORS, STORE_WHATSAPP };
