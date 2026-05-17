const express = require('express');
const https   = require('https');
const http    = require('http');
const path    = require('path');
const cors    = require('cors');
const url     = require('url');

const app         = express();
const PORT        = process.env.PORT || 3000;
const GAS_URL     = process.env.GAS_URL || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@empresa.com';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({ ok: true, versao: '1.0.0', gas: !!GAS_URL });
});

function fetchWithRedirects(targetUrl, maxRedirects, callback) {
  if (maxRedirects === 0) return callback(new Error('Muitos redirecionamentos'), null);
  const parsed  = url.parse(targetUrl);
  const lib     = parsed.protocol === 'https:' ? https : http;
  const options = {
    hostname: parsed.hostname,
    port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path:     parsed.path,
    method:   'GET',
    headers: { 'Accept': 'application/json, text/plain, */*', 'User-Agent': 'AdAnalyzer/1.0' }
  };
  const req = lib.request(options, (res) => {
    if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
      const redirectUrl = res.headers.location.startsWith('http')
        ? res.headers.location
        : parsed.protocol + '//' + parsed.hostname + res.headers.location;
      res.resume();
      return fetchWithRedirects(redirectUrl, maxRedirects - 1, callback);
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => callback(null, data));
  });
  req.on('error', err => callback(err, null));
  req.end();
}

app.get('/api/gas', (req, res) => {
  if (!GAS_URL) return res.status(500).json({ ok: false, erro: 'GAS_URL nao configurada' });
  const params = new URLSearchParams(req.query);
  if (!params.has('email')) params.set('email', ADMIN_EMAIL);
  const fullUrl = GAS_URL + (GAS_URL.includes('?') ? '&' : '?') + params.toString();
  console.log('[GAS] ->', fullUrl.replace(/email=[^&]+/, 'email=***'));
  fetchWithRedirects(fullUrl, 5, (err, data) => {
    if (err) return res.status(500).json({ ok: false, erro: err.message });
    if (!data || data.trim() === '') return res.status(500).json({ ok: false, erro: 'Resposta vazia' });
    if (data.trim().startsWith('<')) return res.status(401).json({ ok: false, erro: 'GAS retornou HTML - verifique: Executar como: Eu | Acesso: Qualquer pessoa' });
    try { res.json(JSON.parse(data)); }
    catch(e) { res.status(500).json({ ok: false, erro: 'JSON invalido: ' + data.slice(0,100) }); }
  });
});

app.post('/api/claude', (req, res) => {
  const { apiKey, ...body } = req.body;
  if (!apiKey) return res.status(400).json({ erro: 'apiKey obrigatorio' });
  const payload = JSON.stringify(body);
  const r = https.request({
    hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(payload) }
  }, (apiRes) => {
    let data = '';
    apiRes.on('data', c => data += c);
    apiRes.on('end', () => { try { res.json(JSON.parse(data)); } catch(e) { res.status(500).json({ erro: 'Resposta invalida' }); } });
  });
  r.on('error', e => res.status(500).json({ erro: e.message }));
  r.write(payload); r.end();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('AdAnalyzer OK porta ' + PORT);
  console.log('GAS:', GAS_URL ? 'configurado' : 'NAO configurado');
});
