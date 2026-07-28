function numberFrom(text, pattern) {
  const match = String(text || '').match(pattern);
  if (!match) return null;
  return Number(String(match[1]).replace(/\./g, '').replace(',', '.'));
}

function generateLocalAnalysis(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const prompt = messages.map((message) => String(message.content || '')).join('\n');
  const spend = numberFrom(prompt, /(?:Total|gasto)[^\d]{0,20}R\$\s*([\d.,]+)/i);
  const ctr = numberFrom(prompt, /CTR[^\d]{0,10}([\d.,]+)%/i);
  const cpc = numberFrom(prompt, /CPC[^\d]{0,10}(?:R\$\s*)?([\d.,]+)/i);

  const findings = [];
  if (ctr !== null) findings.push(ctr < 1
    ? `O CTR de ${ctr.toFixed(2)}% está baixo; priorize novos criativos e revise a segmentação.`
    : `O CTR de ${ctr.toFixed(2)}% indica interesse, mas deve ser comparado com leads e vendas.`);
  if (cpc !== null) findings.push(cpc > 2
    ? `O CPC de R$ ${cpc.toFixed(2)} merece revisão antes de aumentar orçamento.`
    : `O CPC de R$ ${cpc.toFixed(2)} está controlado; valide a qualidade dos leads.`);
  if (spend !== null) findings.push(`Há R$ ${spend.toFixed(2)} de investimento no contexto analisado.`);
  if (!findings.length) findings.push('Os dados foram recebidos, mas faltam métricas estruturadas para uma conclusão numérica segura.');

  return [
    'ANÁLISE LOCAL (sem IA externa)',
    '',
    ...findings.map((finding) => `• ${finding}`),
    '',
    'Prioridades:',
    '1. Corrigir campanhas com CTR baixo ou CPC alto antes de escalar.',
    '2. Comparar gasto com leads e vendas reais do Kommo.',
    '3. Manter campanhas sem identificação de loja fora do rateio até classificá-las.',
    '4. Validar resultados por pelo menos 7 dias antes de realocar orçamento.',
  ].join('\n');
}

module.exports = { generateLocalAnalysis };
