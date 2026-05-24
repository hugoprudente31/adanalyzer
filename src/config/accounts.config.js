/**
 * AdAnalyzer — accounts.config.js
 * Configuração de todas as contas conectadas.
 */

const ACCOUNTS = {

  // ── Google Ads ────────────────────────────────────────────
  googleAds: [
    { id: "2281632986", name: "Olhar Saudável Optometria",   slug: "olhar-saudavel",       color: "#4285F4" },
    { id: "1420756198", name: "Óticas TGT - Enseada",        slug: "tgt-enseada",           color: "#34A853" },
    { id: "9212873095", name: "Óticas TGT - Gonzaga",        slug: "tgt-gonzaga",           color: "#FBBC05" },
    { id: "4121362472", name: "Óticas TGT - Pitangueiras",   slug: "tgt-pitangueiras",      color: "#EA4335" },
    { id: "5679539198", name: "Óticas Target - Santo Antonio", slug: "target-santo-antonio", color: "#9C27B0" },
  ],

  // ── Google Analytics 4 ────────────────────────────────────
  googleAnalytics: [
    { id: "411174236", name: "Oticas Target GA4",      group: "Oticas Target GA4",            slug: "ga4-target"     },
    { id: "529864797", name: "Site Multi Lojas",        group: "Óticas TGT Site Multi Lojas",  slug: "ga4-multilojas" },
    { id: "538727883", name: "GA4 - Loja de Gonzaga",  group: "Loja Gonzaga",                 slug: "ga4-gonzaga"    },
  ],

  // ── Google Search Console ─────────────────────────────────
  searchConsole: [
    { id: "https://oticastgt.com.br/", name: "oticastgt.com.br", slug: "oticastgt" },
  ],

  // ── Meta Ads ──────────────────────────────────────────────
  metaAds: {
    accountId: process.env.META_AD_ACCOUNT_ID,
    token:     process.env.META_ACCESS_TOKEN,
  },
};

ACCOUNTS.allGoogleAdsIds = ACCOUNTS.googleAds.map((a) => a.id);
ACCOUNTS.findGoogleAds   = (id) => ACCOUNTS.googleAds.find((a) => a.id === id || a.slug === id) || null;
ACCOUNTS.findGA4         = (id) => ACCOUNTS.googleAnalytics.find((a) => a.id === id || a.slug === id) || null;

module.exports = ACCOUNTS;
