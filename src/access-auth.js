const textEncoder = new TextEncoder();
let jwksCache = { url: "", expiresAt: 0, keys: new Map() };

export async function requireAdminAccess(request, env) {
  const url = new URL(request.url);
  if (isLocalHost(url.hostname)) return { email: "local@cvstudio", local: true };

  const token = request.headers.get("cf-access-jwt-assertion") || "";
  const headerEmail = (request.headers.get("cf-access-authenticated-user-email") || "").trim().toLowerCase();
  if (!token || !headerEmail) throw accessError("No autorizado", 403);

  const allowed = parseList(env.ADMIN_EMAILS);
  if (allowed.length && !allowed.includes(headerEmail)) throw accessError("No autorizado", 403);

  let claims = null;
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    claims = await validateAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
    const claimEmail = String(claims.email || claims.common_name || "").trim().toLowerCase();
    if (claimEmail && claimEmail !== headerEmail) throw accessError("No autorizado", 403);
  }

  return { email: headerEmail, claims, local: false };
}

export function verifyRequestOrigin(request, env) {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  const url = new URL(request.url);
  if (isLocalHost(url.hostname)) {
    const origin = request.headers.get("origin");
    if (!origin || !["http://127.0.0.1:10060", "http://localhost:10060"].includes(origin)) {
      throw accessError("Origen no permitido", 403);
    }
    return;
  }
  const expected = new URL(env.PUBLIC_BASE_URL || url.origin).origin;
  const origin = request.headers.get("origin");
  if (!origin || origin !== expected) throw accessError("Origen no permitido", 403);
}

export function isLocalRequest(request) {
  return isLocalHost(new URL(request.url).hostname);
}

async function validateAccessJwt(token, teamDomain, expectedAud) {
  const parts = token.split(".");
  if (parts.length !== 3) throw accessError("Token de Access no válido", 403);
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw accessError("Token de Access no válido", 403);

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= now) throw accessError("Sesión de Access caducada", 403);
  if (payload.nbf && payload.nbf > now + 30) throw accessError("Token de Access aún no válido", 403);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(expectedAud)) throw accessError("Audience de Access no válida", 403);

  const host = normalizeTeamDomain(teamDomain);
  const issuer = `https://${host}`;
  if (payload.iss && payload.iss.replace(/\/$/, "") !== issuer) throw accessError("Issuer de Access no válido", 403);

  const key = await getSigningKey(host, header.kid);
  const data = textEncoder.encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlBytes(parts[2]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  if (!ok) throw accessError("Firma de Access no válida", 403);
  return payload;
}

async function getSigningKey(host, kid) {
  const url = `https://${host}/cdn-cgi/access/certs`;
  const now = Date.now();
  if (jwksCache.url !== url || jwksCache.expiresAt <= now) {
    const response = await fetch(url, { headers: { accept: "application/json" }, cf: { cacheTtl: 1800, cacheEverything: true } });
    if (!response.ok) throw accessError("No se pudieron validar las credenciales de Access", 503);
    const body = await response.json();
    const map = new Map();
    for (const jwk of body.keys || []) if (jwk?.kid) map.set(jwk.kid, jwk);
    jwksCache = { url, expiresAt: now + 30 * 60 * 1000, keys: map };
  }
  let jwk = jwksCache.keys.get(kid);
  if (!jwk) {
    jwksCache.expiresAt = 0;
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw accessError("No se pudieron validar las credenciales de Access", 503);
    const body = await response.json();
    const map = new Map();
    for (const item of body.keys || []) if (item?.kid) map.set(item.kid, item);
    jwksCache = { url, expiresAt: Date.now() + 30 * 60 * 1000, keys: map };
    jwk = map.get(kid);
  }
  if (!jwk) throw accessError("Clave de firma de Access no reconocida", 403);
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

function decodeJson(value) {
  try { return JSON.parse(new TextDecoder().decode(base64UrlBytes(value))); }
  catch { throw accessError("Token de Access no válido", 403); }
}
function base64UrlBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function normalizeTeamDomain(value) {
  return String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
function parseList(value) { return String(value || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean); }
function isLocalHost(host) { return host === "127.0.0.1" || host === "localhost"; }
function accessError(message, status) { const e = new Error(message); e.status = status; return e; }
