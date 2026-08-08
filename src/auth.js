/**
 * Sesión del panel.
 *
 * Antes de esto, /api/* era público: cualquiera que llegase al dominio podía
 * enviar correos con tu SMTP, sustituir el PDF y leer destinatarios e IPs.
 *
 * Cookie firmada con HMAC-SHA256 (SESSION_SECRET), HttpOnly + SameSite=Strict.
 * No sustituye a Cloudflare Access, que sigue siendo la opción recomendada
 * delante de todo el Worker; esto es el mínimo para no publicarlo desnudo.
 */

const COOKIE = "ot_session";
const DEFAULT_TTL_HOURS = 8;
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const attempts = new Map(); // best-effort por isolate; el rate limit real va en Cloudflare

const enc = new TextEncoder();

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (value) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function timingSafeEqual(a = "", b = "") {
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i += 1) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function secret(env) {
  return env.SESSION_SECRET || env.ADMIN_PASSWORD || "";
}

/** El bypass de autenticación solo existe si se habilita explícitamente en desarrollo. */
export function authDisabled(env) {
  return env.LOCAL_MODE === "true" && String(env.AUTH_DISABLED || "").toLowerCase() === "true";
}

export async function createSessionCookie(env, url) {
  const ttlHours = Number(env.SESSION_TTL_HOURS) || DEFAULT_TTL_HOURS;
  const expires = Date.now() + ttlHours * 3600 * 1000;
  const payload = b64url(enc.encode(JSON.stringify({ exp: expires, iat: Date.now() })));
  const signature = await hmac(secret(env), payload);
  const attributes = [
    `${COOKIE}=${payload}.${signature}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${ttlHours * 3600}`
  ];
  if (url.protocol === "https:") attributes.push("Secure");
  return attributes.join("; ");
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function hasValidSession(request, env) {
  if (authDisabled(env)) return true;
  const raw = readCookie(request, COOKIE);
  if (!raw || !raw.includes(".")) return false;
  const [payload, signature] = raw.split(".");
  const expected = await hmac(secret(env), payload);
  if (!timingSafeEqual(signature, expected)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export function registerAttempt(request) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const now = Date.now();
  const record = attempts.get(ip)?.filter((t) => now - t < ATTEMPT_WINDOW_MS) || [];
  record.push(now);
  attempts.set(ip, record);
  return record.length;
}

export function tooManyAttempts(request) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const now = Date.now();
  const record = attempts.get(ip)?.filter((t) => now - t < ATTEMPT_WINDOW_MS) || [];
  return record.length >= MAX_ATTEMPTS;
}

export function clearAttempts(request) {
  attempts.delete(request.headers.get("cf-connecting-ip") || "local");
}

export async function handleLogin(request, env, url) {
  if (tooManyAttempts(request)) {
    return new Response(JSON.stringify({ error: "Demasiados intentos. Espera unos minutos." }), {
      status: 429,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (!env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "ADMIN_PASSWORD no está configurada en el entorno." }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  if (!timingSafeEqual(password, env.ADMIN_PASSWORD)) {
    registerAttempt(request);
    return new Response(JSON.stringify({ error: "Credenciales incorrectas." }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  clearAttempts(request);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": await createSessionCookie(env, url)
    }
  });
}

export function handleLogout() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "set-cookie": clearSessionCookie() }
  });
}

/**
 * Rutas accesibles sin sesión: la portada de login (/), descarga por token,
 * salud del servicio y assets estáticos. app.html y las API privadas exigen
 * una sesión válida.
 */
export function isPublicPath(path) {
  return (
    path.startsWith("/download/") ||
    path === "/api/health" ||
    path === "/api/session" ||
    path === "/" ||
    path === "/index.html" ||
    /\.(css|js|map|png|svg|ico|woff2?)$/.test(path)
  );
}
