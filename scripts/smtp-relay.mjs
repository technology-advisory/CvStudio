import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

loadDevVars();

const HOST = "127.0.0.1";
const PORT = Number(process.env.LOCAL_MAIL_RELAY_PORT || 10061);
const RELAY_KEY = process.env.LOCAL_MAIL_RELAY_KEY || "local-development-only";

const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`[mail-relay] Configuración incompleta en .dev.vars: ${missing.join(", ")}`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: String(process.env.SMTP_SECURITY || "starttls").toLowerCase() === "ssl",
  requireTLS: String(process.env.SMTP_SECURITY || "starttls").toLowerCase() === "starttls",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    minVersion: "TLSv1.2",
    servername: process.env.SMTP_HOST
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000
});

const server = http.createServer(async (request, response) => {
  setCors(response, request);

  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  if (request.url === "/health" && request.method === "GET") {
    return json(response, 200, { ok: true, service: "local-smtp-relay" });
  }

  if (request.url !== "/send" || request.method !== "POST") {
    return json(response, 404, { error: "Ruta no encontrada." });
  }

  if (request.headers["x-local-relay-key"] !== RELAY_KEY) {
    return json(response, 403, { error: "Acceso no autorizado al relay local." });
  }

  try {
    const body = await readJson(request);
    const to = validateEmail(body.to);
    const subject = clean(body.subject, 180);
    if (!subject) throw new Error("El asunto está vacío.");
    if (!body.html || !body.text) throw new Error("El contenido del correo está incompleto.");

    const info = await transporter.sendMail({
      from: {
        name: process.env.SMTP_FROM_NAME || "Miguel Ángel Carriazo · OpenTrust Group",
        address: process.env.SMTP_FROM
      },
      to,
      replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_FROM,
      subject,
      text: String(body.text),
      html: String(body.html)
    });

    console.log(`[mail-relay] Correo enviado a ${maskEmail(to)} · ${info.messageId}`);
    return json(response, 200, { ok: true, messageId: info.messageId, accepted: info.accepted?.length || 0 });
  } catch (error) {
    console.error("[mail-relay] Error SMTP:", error);
    return json(response, 502, {
      error: "No se pudo enviar el correo mediante Zoho SMTP.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, HOST, async () => {
  console.log(`[mail-relay] Escuchando en http://${HOST}:${PORT}`);
  try {
    await transporter.verify();
    console.log("[mail-relay] Conexión y autenticación SMTP verificadas.");
  } catch (error) {
    console.error("[mail-relay] La verificación SMTP ha fallado:", error instanceof Error ? error.message : error);
  }
});

function loadDevVars() {
  const file = path.resolve(process.cwd(), ".dev.vars");
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) request.destroy(new Error("Solicitud demasiado grande."));
    });
    request.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { reject(new Error("JSON no válido.")); }
    });
    request.on("error", reject);
  });
}

function validateEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Dirección de correo no válida.");
  return email;
}

function clean(value, max) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function setCors(response, request) {
  const allowed = new Set(["http://127.0.0.1:10060", "http://localhost:10060"]);
  const origin = request?.headers?.origin;
  response.setHeader("access-control-allow-origin", allowed.has(origin) ? origin : "http://127.0.0.1:10060");
  response.setHeader("access-control-allow-headers", "content-type,x-local-relay-key");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}
