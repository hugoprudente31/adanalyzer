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

const express = require('express');
const fetch   = require('node-fetch');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;


// ── Configurações ─────────────────────────────────────────────
const GAS_URL     = 'https://script.google.com/macros/s/AKfycbxDyY44dANjV7cyH4Jc1O7xgNuX7zr3-hrM7a15bCgRecoeKxW5ZUrSEBj0P6P9upTcdA/exec';
const ADMIN_EMAIL = 'admin@empresa.com';

// ── Middlewares ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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

// ── Status ────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    ok:      true,
    versao:  '1.0.0',
    gas_url: GAS_URL.replace(/AKfycbx[^/]+/, 'AKfycbx***'),
    admin:   ADMIN_EMAIL,
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
