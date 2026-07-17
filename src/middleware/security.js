const crypto = require('crypto');
const PUBLIC_PATHS = new Set(['/health', '/api/status']);
function safeEqual(actual, expected) { const a = Buffer.from(String(actual || '')); const b = Buffer.from(String(expected || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function challenge(res) { res.set('WWW-Authenticate', 'Basic realm="AdAnalyzer", charset="UTF-8"'); return res.status(401).json({ error: 'Autenticação necessária' }); }
function basicAuth(req, res, next) {
  if (PUBLIC_PATHS.has(req.path)) return next();
  const username = process.env.BASIC_AUTH_USER; const password = process.env.BASIC_AUTH_PASSWORD;
  if (!username || !password) { if (process.env.NODE_ENV === 'production') return res.status(503).json({ error: 'Autenticação administrativa não configurada' }); return next(); }
  const [scheme, encoded] = String(req.headers.authorization || '').split(' '); if (scheme !== 'Basic' || !encoded) return challenge(res);
  let decoded = ''; try { decoded = Buffer.from(encoded, 'base64').toString('utf8'); } catch { return challenge(res); }
  const separator = decoded.indexOf(':'); if (separator < 0) return challenge(res);
  if (!safeEqual(decoded.slice(0, separator), username) || !safeEqual(decoded.slice(separator + 1), password)) return challenge(res);
  next();
}
module.exports = { basicAuth };
