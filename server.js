// ═══════════════════════════════════════════════════════════════
//  AdAnalyzer — server.js
//  Servidor local que resolve o CORS do GAS
//
//  COMO USAR:
//  1. Abra o terminal no VS Code (Ctrl+`)
//  2. npm install
//  3. node server.js
//  4. Abra http://localhost:3000
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();

const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');
const path    = require('path');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const { basicAuth } = require('./src/middleware/security');

const app  = express();
const PORT = process.env.PORT || 3000;


// ── Configurações ─────────────────────────────────────────────
const GAS_URL     = process.env.GAS_URL || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@empresa.com';
const schedulingSystem = require('./src/services/schedulingSystem');

// ── Middlewares ───────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://ads.oticastgt.com.br').split(',').map(value => value.trim()).filter(Boolean);
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin))) return callback(null, true);
  callback(new Error('Origem não permitida'));
}, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/claude', rateLimit({ windowMs: 60_000, limit: 10 }));
app.use('/api/openai', rateLimit({ windowMs: 60_000, limit: 5 }));
app.use(basicAuth);

// ── Rotas Meta Ads (Graph API completa) ──────────────────────
app.use('/api/meta/v2', require('./src/routes/metaAds'));

// ── Google Ads + GA4 + Search Console ────────────────────────
app.use('/api/analytics', require('./src/routes/analytics.routes'));

// ── OAuth Meta ────────────────────────────────────────────────
app.use('/auth', require('./src/routes/oauth'));

// ── OAuth Google ──────────────────────────────────────────────
app.use('/auth', require('./src/routes/googleOAuth'));

// ── Google APIs (GA4 + Search Console + GTM) ─────────────────
app.use('/api/google', require('./src/routes/googleApis.routes'));

// ── GTM Admin (auto-provisionamento de tags) ──────────────────
app.use('/api/gtm', require('./src/routes/gtmAdmin.routes'));

// ── Dashboard por loja (Meta Ads + IA) ───────────────────────
app.use('/api/dashboard', require('./src/routes/dashboard'));

// ── Live Dashboard (Meta + Google Ads em tempo real) ─────────
app.use('/api/live-dashboard', require('./src/routes/live-dashboard'));

// ── Kommo (leads, contatos, funis) replicado no Postgres ─────
app.use('/api/kommo', require('./src/routes/kommoDb.routes'));

// ── Sync diário de desempenho de anúncios → github-sistema ──
require('./src/jobs/syncGithubSistema').start();

// ── Sync diário de leads/contatos/funis do Kommo ─────────────
require('./src/jobs/syncKommoData').start();

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  const ACCOUNTS = require('./src/config/accounts.config');
  res.json({
    status: 'ok',
    service: 'AdAnalyzer',
    timestamp: new Date().toISOString(),
    connectedAccounts: {
      googleAds: ACCOUNTS.googleAds.length,
      ga4: ACCOUNTS.googleAnalytics.length,
      searchConsole: ACCOUNTS.searchConsole.length,
      metaAds: !!process.env.META_ACCESS_TOKEN,
    },
  });
});

// ── Dashboard React (componente adanalyzer-dashboard.jsx) ────
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ── Live Dashboard ────────────────────────────────────────────
app.get('/live', (req, res) => {
  res.sendFile(path.join(__dirname, 'live-dashboard.html'));
});

// Serve arquivos estáticos da pasta atual
app.use(express.static(__dirname));

// ── Rota principal — serve o AdAnalyzer ──────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'adanalyzer.html'));
});

// ── Proxy GAS: /api/gas?format=roi&dias=30 ───────────────────
// O browser chama localhost (sem CORS).
// O servidor chama o GAS (servidor não tem restrição de CORS).
app.get('/api/gas', async (req, res) => {
  try {
    // Monta os parâmetros adicionando o email admin
    const params = new URLSearchParams(req.query);
    if (!params.has('email')) params.set('email', ADMIN_EMAIL);

    const gasEndpoint = `${GAS_URL}?${params.toString()}`;

    console.log(`[GAS] → ${gasEndpoint}`);

    const response = await fetch(gasEndpoint, {
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain',
        'User-Agent': 'AdAnalyzer/1.0'
      },
      timeout: 30000
    });

    const text = await response.text();

    // Verifica se recebeu HTML de login (GAS mal configurado)
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      console.error('[GAS] Recebeu HTML — verifique "Quem tem acesso: Qualquer pessoa"');
      return res.status(401).json({
        ok: false,
        erro: 'GAS retornou página de login. Configure: Implantar → Quem tem acesso: Qualquer pessoa'
      });
    }

    // Tenta parsear como JSON
    try {
      const json = JSON.parse(text);
      console.log(`[GAS] ✅ Resposta OK — ${Object.keys(json).join(', ')}`);
      res.json(json);
    } catch(e) {
      console.error('[GAS] Resposta inválida:', text.slice(0, 200));
      res.status(500).json({ ok: false, erro: 'Resposta inválida do GAS: ' + text.slice(0, 100) });
    }

  } catch(err) {
    console.error('[GAS] Erro:', err.message);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// PostgreSQL scheduling metrics through the authenticated scheduling API.
app.get('/api/scheduling-performance', async (req, res) => {
  try {
    const end = String(req.query.end || new Date().toISOString().slice(0, 10));
    const start = String(req.query.start || `${end.slice(0, 8)}01`);
    res.json(await schedulingSystem.getMarketingPerformance(start, end));
  } catch (err) {
    console.error('[SchedulingSystem] Erro:', err.message);
    res.status(502).json({ ok: false, error: 'Sistema de agendamento indisponível' });
  }
});

// ── Proxy Meta Ads: /api/meta ─────────────────────────────────
// Também serve como proxy para a Meta Graph API
app.get('/api/meta', async (req, res) => {
  try {
    const { endpoint: metaEndpoint, ...params } = req.query;
    if (!metaEndpoint) return res.status(400).json({ erro: 'endpoint obrigatório' });

    const url = `https://graph.facebook.com/${metaEndpoint}?${new URLSearchParams(params)}`;
    console.log(`[META] → ${url.replace(/access_token=[^&]+/, 'access_token=***')}`);

    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'Accept': 'application/json' },
      timeout: 30000
    });

    const json = await response.json();
    res.json(json);

  } catch(err) {
    console.error('[META] Erro:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// ── Proxy Anthropic Claude: /api/claude ──────────────────────
app.post('/api/claude', async (req, res) => {
  try {
    const { apiKey, ...body } = req.body;
    if (!apiKey) return res.status(400).json({ erro: 'apiKey obrigatório' });

    console.log('[CLAUDE] → Enviando análise...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body),
      timeout: 60000
    });

    const json = await response.json();
    if (json.error) {
      console.error('[CLAUDE] Erro API:', json.error.message);
    } else {
      console.log('[CLAUDE] ✅ Resposta gerada');
    }
    res.json(json);

  } catch(err) {
    console.error('[CLAUDE] Erro:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// ── Proxy Builderall / CRM eb4us: /api/builderall ───────────
app.get('/api/builderall', async (req, res) => {
  try {
    const { account, path, api_key, cKey, ...rest } = req.query;
    if (!account || !path) return res.status(400).json({ erro: 'account e path obrigatórios' });

    const base   = account.startsWith('http') ? account : `https://${account}`;
    const qp     = new URLSearchParams(rest);
    if (cKey)    qp.set('cKey', cKey);
    if (api_key) qp.set('api_key', api_key);
    const url = `${base}${path}?${qp}`;

    const logUrl = url
      .replace(/cKey=[^&]+/, 'cKey=***')
      .replace(/api_key=[^&]+/, 'api_key=***');
    console.log(`[BUILDERALL] → ${logUrl}`);

    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'AdAnalyzer/1.0',
      'Content-Type': 'application/json',
    };
    if (api_key) headers['Authorization'] = `Bearer ${api_key}`;
    if (cKey)    headers['X-CRM-Key']     = cKey;

    const response = await fetch(url, { redirect: 'follow', headers, timeout: 30000 });
    const text = await response.text();

    try {
      res.json(JSON.parse(text));
    } catch(e) {
      console.error('[BUILDERALL] Resposta não-JSON:', text.slice(0, 300));
      res.status(502).json({ erro: 'Resposta inválida', raw: text.slice(0, 300), status: response.status });
    }
  } catch(err) {
    console.error('[BUILDERALL] Erro:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ── Proxy OpenAI (DALL-E): /api/openai/images ────────────────
app.post('/api/openai/images', async (req, res) => {
  try {
    const { apiKey, ...body } = req.body;
    if (!apiKey) return res.status(400).json({ error: { message: 'apiKey obrigatório' } });

    console.log('[OPENAI] → Gerando imagem DALL-E...');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      timeout: 90000
    });

    const json = await response.json();
    if (json.error) {
      console.error('[OPENAI] Erro:', json.error.message);
    } else {
      console.log('[OPENAI] ✅ Imagem gerada');
    }
    res.json(json);

  } catch(err) {
    console.error('[OPENAI] Erro:', err.message);
    res.status(500).json({ error: { message: err.message } });
  }
});

// ── Nexus Studio (React app): /studio ────────────────────────
app.use('/studio', express.static(path.join(__dirname, 'studio')));
app.get('/studio/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'studio', 'index.html'));
});

// ── Status ────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  const googleDirectMissing = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN'
  ].filter((name) => !process.env[name]);
  if (!process.env.GOOGLE_ADS_MANAGER_ID && !process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    googleDirectMissing.push('GOOGLE_ADS_MANAGER_ID (ou GOOGLE_ADS_LOGIN_CUSTOMER_ID)');
  }
  res.json({
    ok:      true,
    versao:  '1.0.0',
    gas_url: GAS_URL.replace(/AKfycbx[^/]+/, 'AKfycbx***'),
    admin:   ADMIN_EMAIL,
    integrations: {
      metaOfficial: !!process.env.META_ACCESS_TOKEN && !!process.env.META_AD_ACCOUNT_ID,
      googleAdsOfficial: googleDirectMissing.length === 0,
      googleAdsMissing: googleDirectMissing,
      schedulingPostgresql: !!process.env.SCHEDULING_SYSTEM_API_URL && !!process.env.ADANALYZER_SYNC_KEY,
      claudeOnDemand: !!process.env.ANTHROPIC_API_KEY,
      supermetricsFallback: !!process.env.SUPERMETRICS_API_KEY
    },
    rotas: [
      'GET  /api/gas?format=roi&dias=30  → ROI do Agendamento',
      'GET  /api/gas?format=json         → Campanhas GAS',
      'GET  /api/meta?endpoint=...       → Meta Graph API',
      'POST /api/claude                  → Claude IA'
    ]
  });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║       AdAnalyzer — Servidor Local         ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log('║  URL:    http://localhost:3000             ║');
  console.log('║  Admin:  admin@empresa.com                 ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log('║  Status: RODANDO - nao feche esta janela  ║');
  console.log('╚═══════════════════════════════════════════╝\n');
});

// Captura erros de porta em uso
app.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERRO] Porta ${PORT} ja esta em uso!`);
    console.error('Feche o outro servidor e tente novamente.\n');
    process.exit(1);
  }
});
