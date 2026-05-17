const express = require('express');
const https   = require('https');
const http    = require('http');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const GAS_URL     = process.env.GAS_URL     || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@empresa.com';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'adanalyzer.html'));
});

app.get('/api/status', (req, res) => {
  res.json({ ok: true, versao: '1.0.0', admin: ADMIN_EMAIL });
});

app.get('/api/gas', (req, res) => {
  if (!GAS_URL) {
    return res.status(500).json({ ok: false, erro: 'GAS_URL não configurada nas variáveis de ambiente' });
  }

  const params = new URLSearchParams(req.query);
  if (!params.has('email')) params.set('email', ADMIN_EMAIL);

  const fullUrl = GAS_URL + (GAS_URL.includes('?') ? '&' : '?') + params.toString();

  const lib = fullUrl.startsWith('https') ? https : http;

  lib.get(fullUrl, { headers: { 'Accept': 'application/json' } }, (gasRes) => {
    let data = '';
    gasRes.on('data', chunk => data += chunk);
    gasRes.on('end', () => {
      if (data.trim().startsWith('<')) {
        return res.status(401).json({ ok: false, erro: 'GAS retornou HTML. Configure: Implantar → Qualquer pessoa' });
      }
      try {
        const json = JSON.parse(data);
        res.json(json);
      } catch(e) {
        res.status(500).json({ ok: false, erro: 'Resposta inválida: ' + data.slice(0, 100) });
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ ok: false, erro: err.message });
  });
});

app.post('/api/claude', (req, res) => {
  const { apiKey, ...body } = req.body;
  if (!apiKey) return res.status(400).json({ erro: 'apiKey obrigatório' });

  const payload = JSON.stringify(body);
  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length':    Buffer.byteLength(payload)
    }
  };

  const req2 = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch(e) { res.status(500).json({ erro: 'Resposta inválida' }); }
    });
  });

  req2.on('error', (err) => res.status(500).json({ erro: err.message }));
  req2.write(payload);
  req2.end();
});

app.listen(PORT, HOST, () => {
  console.log(`AdAnalyzer rodando em http://${HOST}:${PORT}`);
  console.log(`Admin: ${ADMIN_EMAIL}`);
});
