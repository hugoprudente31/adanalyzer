/**
 * AdAnalyzer — storeAliasMap.js
 * Traduz os nomes de loja usados internamente (storeConsolidation.js)
 * para os 4 nomes canônicos do github-sistema (fonte única de verdade
 * do banco de dados). "Multi Lojas" e "Outros" não têm loja única
 * correspondente e por isso não entram neste mapa — o job de sync
 * os envia separadamente, sem loja, apenas para transparência de gasto.
 */

const ADANALYZER_TO_CANONICAL = {
  "Gonzaga/Santos": "óticas TGT - Gonzaga",
  "Enseada": "óticas TGT Enseada",
  "Pitangueiras": "óticas TGT Pitangueiras",
  "Target": "óticas Target - Ademar de Barros",
};

const SEM_LOJA_UNICA = ["Multi Lojas", "Outros"];

function toCanonicalStore(nomeAdAnalyzer) {
  return ADANALYZER_TO_CANONICAL[nomeAdAnalyzer] || null;
}

module.exports = { ADANALYZER_TO_CANONICAL, SEM_LOJA_UNICA, toCanonicalStore };
