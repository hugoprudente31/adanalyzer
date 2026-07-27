/**
 * Convenção real observada nos nomes dos estágios desta conta Kommo (não
 * existe um campo booleano "ganho/perdido" confiável — os 4 funis usam nomes
 * como "Venda ganha", "Venda perdida", "Venda Fechada").
 *
 * Portado verbatim de src/services/kommoDb.service.js — não alterar sem
 * verificar contra os nomes reais de status em produção.
 */
export const WON_PATTERN = /ganh|fechad/i;
export const LOST_PATTERN = /perdid/i;
