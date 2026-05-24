/**
 * AdAnalyzer — OAuth Meta (Fluxo multi-conta)
 */

const express = require("express");
const router = express.Router();

const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.META_REDIRECT_URI;
const API_VERSION = process.env.META_API_VERSION || "v19.0";

const SCOPES = ["ads_read", "ads_management", "business_management", "pages_read_engagement"].join(",");

const tokenStore = new Map();

function saveToken(userId, tokenData) {
  tokenStore.set(userId, { ...tokenData, savedAt: new Date().toISOString() });
}

function getToken(userId) {
  return tokenStore.get(userId) || null;
}

// GET /auth/meta — inicia OAuth
router.get("/meta", (req, res) => {
  if (!APP_ID || !REDIRECT_URI) {
    return res.status(500).json({ error: "META_APP_ID ou META_REDIRECT_URI não configurados" });
  }

  const state = Math.random().toString(36).substring(2);
  const authUrl = new URL(`https://www.facebook.com/${API_VERSION}/dialog/oauth`);
  authUrl.searchParams.set("client_id", APP_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  res.redirect(authUrl.toString());
});

// GET /auth/meta/callback
router.get("/meta/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error("[OAuth] Usuário negou permissão:", error_description);
    return res.redirect("/?auth=denied");
  }

  try {
    const shortToken = await exchangeCodeForToken(code);
    const longToken = await extendToken(shortToken.access_token);
    const userInfo = await fetchUserInfo(longToken.access_token);

    saveToken(userInfo.id, {
      accessToken: longToken.access_token,
      expiresIn: longToken.expires_in,
      userId: userInfo.id,
      userName: userInfo.name,
    });

    console.log(`[OAuth] Usuário conectado: ${userInfo.name} (${userInfo.id})`);
    res.redirect(`/?auth=success&user=${encodeURIComponent(userInfo.name)}`);
  } catch (err) {
    console.error("[OAuth Callback Error]", err.message);
    res.redirect(`/?auth=error&message=${encodeURIComponent(err.message)}`);
  }
});

// GET /auth/meta/status
router.get("/meta/status", (req, res) => {
  const systemToken = process.env.META_ACCESS_TOKEN;

  if (systemToken) {
    return res.json({
      connected: true,
      mode: "system_token",
      accountId: process.env.META_AD_ACCOUNT_ID,
      message: "Usando token de sistema configurado no Railway",
    });
  }

  const userId = req.query.userId;
  if (userId) {
    const tokenData = getToken(userId);
    return res.json({ connected: !!tokenData, mode: "oauth", user: tokenData?.userName || null });
  }

  res.json({ connected: false });
});

// GET /auth/meta/logout
router.get("/meta/logout", (req, res) => {
  const { userId } = req.query;
  if (userId) tokenStore.delete(userId);
  res.json({ success: true, message: "Conta Meta desconectada" });
});

async function exchangeCodeForToken(code) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`Erro ao trocar code: ${data.error.message}`);
  return data;
}

async function extendToken(shortLivedToken) {
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("client_secret", APP_SECRET);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`Erro ao estender token: ${data.error.message}`);
  return data;
}

async function fetchUserInfo(accessToken) {
  const url = new URL("https://graph.facebook.com/me");
  url.searchParams.set("fields", "id,name,email");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`Erro ao buscar usuário: ${data.error.message}`);
  return data;
}

module.exports = router;
module.exports.getToken = getToken;
