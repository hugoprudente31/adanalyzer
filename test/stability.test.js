const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source(file) {
  return fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
}

test('healthchecks ficam fora do rate limit global', () => {
  const server = source('server.js');
  assert.match(server, /skip:\s*\(req\)\s*=>\s*req\.path === '\/health'/);
  assert.match(server, /req\.path === '\/api\/status'/);
});

test('healthchecks validam conexão real com PostgreSQL', () => {
  const server = source('server.js');
  assert.match(server, /await db\.query\('SELECT 1'\)/);
  assert.match(server, /databaseReachable/);
});

test('dashboard não reinicia o polling quando os dados mudam', () => {
  const dashboard = source('dashboard.html');
  assert.match(dashboard, /const lastDataRef = useRef\(null\)/);
  assert.match(dashboard, /\}, \[startDate, endDate\]\);/);
  assert.doesNotMatch(dashboard, /\}, \[startDate, endDate, prevData\]\);/);
});

test('proxies de IA ignoram chaves enviadas pelo navegador', () => {
  const server = source('server.js');
  assert.match(server, /const apiKey = process\.env\.ANTHROPIC_API_KEY/);
  assert.match(server, /const apiKey = process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(server, /clientKey \|\| process\.env\.ANTHROPIC_API_KEY/);
});

test('análise local funciona sem provedor externo', () => {
  const { generateLocalAnalysis } = require('../src/services/localAnalysis');
  const result = generateLocalAnalysis({
    messages: [{ content: 'Total gasto R$ 1.250,00; CTR 0,70%; CPC R$ 2,50' }],
  });
  assert.match(result, /ANÁLISE LOCAL/);
  assert.match(result, /CTR de 0\.70% está baixo/);
  assert.match(result, /CPC de R\$ 2\.50 merece revisão/);
});

test('proxy Builderall restringe host e caminho', () => {
  const server = source('server.js');
  assert.match(server, /new Set\(\['app\.mailingboss\.com'\]\)/);
  assert.match(server, /startsWith\('\/api\/'\)/);
});

test('live dashboard usa Kondado em vez de renovar OAuth Google', () => {
  const live = source('src/routes/live-dashboard.js');
  assert.match(live, /marketingDb\.getGoogleAdsDashboard/);
  assert.match(live, /googleDataSource:\s+'kondado_postgresql'/);
});

test('Nexus não guarda credenciais de integrações no navegador', () => {
  const integrations = source('studio-src/src/Integrations.jsx');
  const carousel = source('studio-src/src/CarouselStudio.jsx');
  assert.doesNotMatch(integrations, /localStorage\.setItem/);
  assert.doesNotMatch(integrations, /REACT_APP_ANTHROPIC/);
  assert.doesNotMatch(carousel, /nexus_openai_key/);
});

test('rotas Kommo podem usar o AdAnalyzer OS com fallback legado', () => {
  const routes = source('src/routes/kommoDb.routes.js');
  assert.match(routes, /ADANALYZER_OS_CRM_URL/);
  assert.match(routes, /ADANALYZER_OS_SYNC_URL/);
  assert.match(routes, /return next\(\)/);
});
