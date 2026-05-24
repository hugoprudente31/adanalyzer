/**
 * AdAnalyzer — Google OAuth
 * Fluxo: /auth/google → Google → /auth/google/callback → salva refresh token
 */

const express    = require("express");
const router     = express.Router();
const { google } = require("googleapis");

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

// Token em memória (Railway reinicia limpam — use DB em produção)
let storedTokens = null;

// GET /auth/google — inicia OAuth
router.get("/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "GOOGLE_CLIENT_ID não configurado" });
  }

  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  res.redirect(url);
});

// GET /auth/google/callback — recebe o code e troca por tokens
router.get("/google/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect("/?google_auth=denied");
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    storedTokens = tokens;

    console.log("[Google OAuth] ✅ Tokens obtidos");
    console.log("[Google OAuth] Refresh token:", tokens.refresh_token ? "✅ recebido" : "⚠️ não recebido");

    if (tokens.refresh_token) {
      console.log("\n========================================");
      console.log("GOOGLE_REFRESH_TOKEN =", tokens.refresh_token);
      console.log("Adicione esta variável no Railway!");
      console.log("========================================\n");
    }

    res.redirect("/?google_auth=success");
  } catch (err) {
    console.error("[Google OAuth Error]", err.message);
    res.redirect(`/?google_auth=error&message=${encodeURIComponent(err.message)}`);
  }
});

// GET /auth/google/show-token — mostra refresh token (TEMPORÁRIO - remover após setup)
router.get("/google/show-token", (req, res) => {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || storedTokens?.refresh_token;
  if (!refreshToken) {
    return res.send(`
      <h2>Token não encontrado</h2>
      <p>Faça login primeiro em <a href="/auth/google">/auth/google</a></p>
    `);
  }
  res.send(`
    <html><body style="font-family:monospace;padding:40px;background:#1a1a1a;color:#fff">
    <h2 style="color:#4CAF50">✅ GOOGLE_REFRESH_TOKEN encontrado</h2>
    <p style="color:#aaa">Copie o token abaixo e adicione nas Variables do Railway:</p>
    <div style="background:#333;padding:20px;border-radius:8px;word-break:break-all;font-size:14px;margin:20px 0">
      <b style="color:#FFD700">GOOGLE_REFRESH_TOKEN</b> =<br><br>
      <span style="color:#90EE90">${refreshToken}</span>
    </div>
    <p style="color:#ff6b6b">⚠️ Após copiar e salvar no Railway, acesse /auth/google/remove-token para apagar esta rota.</p>
    </body></html>
  `);
});

// GET /auth/google/status — verifica conexão
router.get("/google/status", (req, res) => {
  const hasRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN || !!storedTokens?.refresh_token;

  res.json({
    connected: hasRefreshToken,
    source: process.env.GOOGLE_REFRESH_TOKEN ? "railway_env" : storedTokens ? "memory" : "none",
    scopes: hasRefreshToken ? SCOPES : [],
  });
});

// Exporta função para criar cliente autenticado (usado pelos services)
function getAuthenticatedClient() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || storedTokens?.refresh_token;
  if (!refreshToken) throw new Error("Google não autenticado. Acesse /auth/google primeiro.");

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

module.exports = router;
module.exports.getAuthenticatedClient = getAuthenticatedClient;
