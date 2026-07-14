const fetch = require('node-fetch');

async function getMarketingPerformance(start, end) {
  const baseUrl = String(process.env.SCHEDULING_SYSTEM_API_URL || '').replace(/\/$/, '');
  const apiKey = process.env.ADANALYZER_SYNC_KEY;
  if (!baseUrl || !apiKey) throw new Error('SCHEDULING_SYSTEM_API_URL ou ADANALYZER_SYNC_KEY não configurados');
  const url = new URL(`${baseUrl}/api/internal/marketing-performance`);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json', 'x-api-key': apiKey }, timeout: 15000 });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(`Sistema de agendamento HTTP ${response.status}`);
  return body;
}

module.exports = { getMarketingPerformance };
