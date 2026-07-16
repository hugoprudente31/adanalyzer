const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const cors = require('cors');
const url = require('url');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const GAS_URL = process.env.GAS_URL || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@empresa.com';

const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v24';
const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
const GOOGLE_ADS_LOGIN_CUSTOMER_ID = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '');
let googleAdsRefreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';

const GOOGLE_ADS_ACCOUNTS = [
  ['Target', process.env.GOOGLE_ADS_CUSTOMER_ID_TARGET],
  ['Enseada', process.env.GOOGLE_ADS_CUSTOMER_ID_ENSEADA],
  ['Gonzaga', process.env.GOOGLE_ADS_CUSTOMER_ID_GONZAGA],
  ['Pitangueiras', process.env.GOOGLE_ADS_CUSTOMER_ID_PITANGUEIRAS]
].map(([name, id]) => ({ name, id: digits(id || '') })).filter(account => account.id);

const oauthStates = new Map();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAdmin(req, res, next) {
  const expectedUser = process.env.BASIC_AUTH_USER || '';
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD || '';
  if (!expectedUser || !expectedPassword) return next();

  const encoded = (req.headers.authorization || '').replace(/^Basic\s+/i, '');
  let user = '';
  let password = '';
  try {
    [user, password] = Buffer.from(encoded, 'base64').toString('utf8').split(/:(.*)/s);
  } catch (_) {}

  if (safeEqual(user, expectedUser) && safeEqual(password, expectedPassword)) return next();
  res.set('WWW-Authenticate', 'Basic realm="AdAnalyzer"');
  return res.status(401).send('Autenticacao administrativa obrigatoria.');
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(item => item.trim()).filter(Boolean).map(item => {
    const index = item.indexOf('=');
    return index < 0 ? [item, ''] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
  }));
}

function googleAdsConfig() {
  return {
    oauth: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI),
    developerToken: Boolean(GOOGLE_ADS_DEVELOPER_TOKEN),
    refreshToken: Boolean(googleAdsRefreshToken),
    loginCustomerId: Boolean(GOOGLE_ADS_LOGIN_CUSTOMER_ID),
    accounts: GOOGLE_ADS_ACCOUNTS.map(({ name, id }) => ({ name, id })),
    apiVersion: GOOGLE_ADS_API_VERSION
  };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({ ok: true, versao: '1.1.0', gas: !!GAS_URL, googleAds: googleAdsConfig() });
});

app.get('/api/google-ads/status', requireAdmin, (req, res) => {
  const config = googleAdsConfig();
  res.json({ ok: true, connected: config.oauth && config.developerToken && config.refreshToken && config.loginCustomerId && config.accounts.length > 0, ...config });
});

app.get('/auth/google-ads', requireAdmin, (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return res.status(500).send('Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no Railway.');
  }

  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  for (const [key, expiry] of oauthStates) if (expiry < Date.now()) oauthStates.delete(key);

  res.set('Cache-Control', 'no-store');
  res.cookie('google_ads_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/auth/google-ads/callback'
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_ADS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/auth/google-ads/callback', requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const state = String(req.query.state || '');
  const cookieState = parseCookies(req).google_ads_oauth_state || '';
  const validUntil = oauthStates.get(state);
  oauthStates.delete(state);

  if (!state || !cookieState || !safeEqual(state, cookieState) || !validUntil || validUntil < Date.now()) {
    return res.status(400).send('Estado OAuth invalido ou expirado. Volte ao AdAnalyzer e tente novamente.');
  }
  if (req.query.error) return res.status(400).send(`Autorizacao cancelada: ${String(req.query.error)}`);

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(req.query.code || ''),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokens.error_description || tokens.error || 'Falha ao trocar codigo OAuth');
    if (!tokens.refresh_token && !googleAdsRefreshToken) throw new Error('O Google nao retornou refresh token. Revogue o acesso do app e autorize novamente.');

    if (tokens.refresh_token) googleAdsRefreshToken = tokens.refresh_token;
    const needsPersistence = !process.env.GOOGLE_ADS_REFRESH_TOKEN && Boolean(tokens.refresh_token);
    const tokenForCopy = needsPersistence ? tokens.refresh_token : '';

    res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Google Ads conectado</title><style>body{font:16px system-ui;background:#0b0b16;color:#eee;max-width:760px;margin:60px auto;padding:24px}main{border:1px solid #30304a;border-radius:14px;padding:28px;background:#111120}code,input{font-family:monospace}input{width:100%;box-sizing:border-box;padding:12px;background:#090913;color:#fff;border:1px solid #444;border-radius:8px}button,a{display:inline-block;margin-top:14px;padding:11px 16px;border-radius:8px;background:#5b5ef4;color:#fff;text-decoration:none;border:0}small{color:#aaa}</style><main><h1>Google Ads autorizado</h1>${needsPersistence ? `<p>Copie o refresh token abaixo uma unica vez e salve no Railway como <code>GOOGLE_ADS_REFRESH_TOKEN</code>. Depois, faca um novo deploy.</p><input id="token" type="password" readonly value="${escapeHtml(tokenForCopy)}"><button onclick="navigator.clipboard.writeText(document.getElementById('token').value);this.textContent='Copiado'">Copiar token</button><p><small>Nao envie esse valor por mensagem, print ou GitHub.</small></p>` : '<p>O refresh token persistente ja esta configurado no Railway.</p>'}<br><a href="/">Voltar ao AdAnalyzer</a></main></html>`);
  } catch (error) {
    res.status(500).send(`Falha na autorizacao Google Ads: ${escapeHtml(error.message)}`);
  }
});

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

async function getGoogleAccessToken() {
  if (!googleAdsRefreshToken) throw new Error('GOOGLE_ADS_REFRESH_TOKEN nao configurado');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: googleAdsRefreshToken,
      grant_type: 'refresh_token'
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Falha ao renovar acesso Google');
  return data.access_token;
}

async function googleAdsSearch(customerId, query, accessToken) {
  const endpoint = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${digits(customerId)}/googleAds:searchStream`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.details?.[0]?.errors?.[0]?.message || data?.error?.message || `Google Ads HTTP ${response.status}`;
    throw new Error(message);
  }
  return (Array.isArray(data) ? data : [data]).flatMap(chunk => chunk.results || []);
}

function micros(value) {
  return Number(value || 0) / 1000000;
}

async function fetchGoogleAdsCampaigns(account, accessToken) {
  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC`;
  const rows = await googleAdsSearch(account.id, query, accessToken);
  return rows.map(row => {
    const cost = micros(row.metrics?.costMicros);
    const clicks = Number(row.metrics?.clicks || 0);
    const impressions = Number(row.metrics?.impressions || 0);
    const conversions = Number(row.metrics?.conversions || 0);
    const conversionValue = Number(row.metrics?.conversionsValue || 0);
    return {
      id: String(row.campaign?.id || ''),
      nome: row.campaign?.name || 'Campanha sem nome',
      fonte: 'Google Ads',
      loja: account.name,
      customerId: account.id,
      status: row.campaign?.status || 'UNKNOWN',
      canal: row.campaign?.advertisingChannelType || 'UNKNOWN',
      periodo: '30 dias',
      orcamento: micros(row.campaignBudget?.amountMicros),
      gastos: round2(cost),
      cliques,
      impressoes: impressions,
      conversoes: round2(conversions),
      valorConv: round2(conversionValue),
      ctr: round2(impressions ? clicks / impressions * 100 : 0),
      cpc: round2(clicks ? cost / clicks : 0),
      cpa: round2(conversions ? cost / conversions : 0),
      roas: round2(cost ? conversionValue / cost : 0)
    };
  });
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

app.get('/api/google-ads/campaigns', requireAdmin, async (req, res) => {
  try {
    const config = googleAdsConfig();
    if (!(config.oauth && config.developerToken && config.refreshToken && config.loginCustomerId)) {
      return res.status(503).json({ ok: false, error: 'Integracao Google Ads incompleta', config });
    }
    const requested = digits(req.query.customer_id || '');
    const accounts = requested ? GOOGLE_ADS_ACCOUNTS.filter(account => account.id === requested) : GOOGLE_ADS_ACCOUNTS;
    if (!accounts.length) return res.status(400).json({ ok: false, error: 'Conta Google Ads nao configurada' });

    const accessToken = await getGoogleAccessToken();
    const settled = await Promise.allSettled(accounts.map(account => fetchGoogleAdsCampaigns(account, accessToken)));
    const campaigns = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const errors = settled.map((result, index) => result.status === 'rejected' ? { account: accounts[index].name, customerId: accounts[index].id, error: result.reason.message } : null).filter(Boolean);
    res.json({ ok: errors.length === 0, partial: errors.length > 0 && campaigns.length > 0, period: 'LAST_30_DAYS', campaigns, errors, updatedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

function fetchWithRedirects(targetUrl, maxRedirects, callback) {
  if (maxRedirects === 0) return callback(new Error('Muitos redirecionamentos'), null);
  const parsed = url.parse(targetUrl);
  const lib = parsed.protocol === 'https:' ? https : http;
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.path,
    method: 'GET',
    headers: { Accept: 'application/json, text/plain, */*', 'User-Agent': 'AdAnalyzer/1.1' }
  };
  const request = lib.request(options, response => {
    if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
      const redirectUrl = response.headers.location.startsWith('http') ? response.headers.location : parsed.protocol + '//' + parsed.hostname + response.headers.location;
      response.resume();
      return fetchWithRedirects(redirectUrl, maxRedirects - 1, callback);
    }
    let data = '';
    response.on('data', chunk => data += chunk);
    response.on('end', () => callback(null, data));
  });
  request.on('error', error => callback(error, null));
  request.end();
}

app.get('/api/gas', (req, res) => {
  if (!GAS_URL) return res.status(500).json({ ok: false, erro: 'GAS_URL nao configurada' });
  const params = new URLSearchParams(req.query);
  if (!params.has('email')) params.set('email', ADMIN_EMAIL);
  const fullUrl = GAS_URL + (GAS_URL.includes('?') ? '&' : '?') + params.toString();
  console.log('[GAS] ->', fullUrl.replace(/email=[^&]+/, 'email=***'));
  fetchWithRedirects(fullUrl, 5, (error, data) => {
    if (error) return res.status(500).json({ ok: false, erro: error.message });
    if (!data || data.trim() === '') return res.status(500).json({ ok: false, erro: 'Resposta vazia' });
    if (data.trim().startsWith('<')) return res.status(401).json({ ok: false, erro: 'GAS retornou HTML - verifique: Executar como: Eu | Acesso: Qualquer pessoa' });
    try { res.json(JSON.parse(data)); }
    catch (_) { res.status(500).json({ ok: false, erro: 'JSON invalido: ' + data.slice(0, 100) }); }
  });
});

app.post('/api/claude', (req, res) => {
  const { apiKey, ...body } = req.body;
  if (!apiKey) return res.status(400).json({ erro: 'apiKey obrigatorio' });
  const payload = JSON.stringify(body);
  const request = https.request({
    hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(payload) }
  }, apiResponse => {
    let data = '';
    apiResponse.on('data', chunk => data += chunk);
    apiResponse.on('end', () => { try { res.json(JSON.parse(data)); } catch (_) { res.status(500).json({ erro: 'Resposta invalida' }); } });
  });
  request.on('error', error => res.status(500).json({ erro: error.message }));
  request.write(payload);
  request.end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('AdAnalyzer OK porta ' + PORT);
  console.log('GAS:', GAS_URL ? 'configurado' : 'NAO configurado');
  console.log('Google Ads:', googleAdsConfig());
});
