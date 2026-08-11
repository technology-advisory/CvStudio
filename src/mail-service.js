import { connect } from "cloudflare:sockets";

export async function sendCvEmail(env, payload) {
  const smtp = getSmtpConfig(env);
  const presentation = getPresentationConfig(env);
  const message = buildMimeMessage(smtp, presentation, payload);
  await sendSmtpMessage(smtp, payload.to, message);
  return { ok: true, provider: "zoho-smtp" };
}

export function buildEmailPreview(env, payload) {
  const config = getPresentationConfig(env);
  return {
    subject: payload.subject || defaultSubject(),
    html: buildHtml(config, payload),
    text: buildText(config, payload)
  };
}

function getSmtpConfig(env) {
  const host = String(env.SMTP_HOST || "smtppro.zoho.eu").trim();
  const port = Number(env.SMTP_PORT || 587);
  const security = String(env.SMTP_SECURITY || "starttls").trim().toLowerCase();
  const user = String(env.SMTP_USER || "").trim();
  const password = String(env.SMTP_PASSWORD || "");
  const from = String(env.SMTP_FROM || user).trim();
  const fromName = String(env.SMTP_FROM_NAME || "Miguel Ángel Carriazo · OpenTrust Group").trim();
  const replyTo = String(env.SMTP_REPLY_TO || from || user).trim();

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Configuración SMTP inválida: revisa SMTP_HOST y SMTP_PORT.");
  }
  if (!user || !password || !from) {
    throw new Error("SMTP no configurado: faltan SMTP_USER, SMTP_PASSWORD o SMTP_FROM.");
  }
  if (!/^starttls$|^ssl$/.test(security)) {
    throw new Error("SMTP_SECURITY debe ser 'starttls' o 'ssl'.");
  }

  return { host, port, security, user, password, from, fromName, replyTo };
}

async function sendSmtpMessage(config, recipient, message) {
  let socket = connect(
    { hostname: config.host, port: config.port },
    { secureTransport: config.security === "starttls" ? "starttls" : "on" }
  );
  await socket.opened;

  let session = new SmtpSession(socket);
  await session.expect([220]);
  await session.command(`EHLO cvstudio.opentrust.group`, [250]);

  if (config.security === "starttls") {
    await session.command("STARTTLS", [220]);
    session.release();
    socket = socket.startTls();
    await socket.opened;
    session = new SmtpSession(socket);
    await session.command(`EHLO cvstudio.opentrust.group`, [250]);
  }

  await session.command("AUTH LOGIN", [334]);
  await session.command(base64Utf8(config.user), [334]);
  await session.command(base64Utf8(config.password), [235]);
  await session.command(`MAIL FROM:<${config.from}>`, [250]);
  await session.command(`RCPT TO:<${recipient}>`, [250, 251]);
  await session.command("DATA", [354]);
  await session.write(`${dotStuff(message)}\r\n.\r\n`);
  await session.expect([250]);

  try {
    await session.command("QUIT", [221]);
  } catch {
    // El mensaje ya fue aceptado; un cierre brusco tras QUIT no invalida el envío.
  } finally {
    session.release();
    await socket.close().catch(() => {});
  }
}

class SmtpSession {
  constructor(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.decoder = new TextDecoder();
    this.encoder = new TextEncoder();
    this.buffer = "";
  }

  async command(line, expectedCodes) {
    await this.write(`${line}\r\n`);
    return this.expect(expectedCodes);
  }

  async write(value) {
    await this.writer.write(this.encoder.encode(value));
  }

  async expect(expectedCodes) {
    const lines = [];
    let code = null;

    while (true) {
      const line = await this.readLine();
      lines.push(line);
      const match = line.match(/^(\d{3})([ -])(.*)$/);
      if (!match) continue;
      const currentCode = Number(match[1]);
      if (code === null) code = currentCode;
      if (match[2] === " " && currentCode === code) break;
    }

    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP ${code}: ${lines.join(" | ")}`);
    }
    return { code, lines };
  }

  async readLine() {
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline !== -1) {
        const line = this.buffer.slice(0, newline).replace(/\r$/, "");
        this.buffer = this.buffer.slice(newline + 1);
        return line;
      }

      const { value, done } = await this.reader.read();
      if (done) {
        if (this.buffer) {
          const line = this.buffer;
          this.buffer = "";
          return line;
        }
        throw new Error("La conexión SMTP se cerró antes de recibir la respuesta esperada.");
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  release() {
    try { this.reader.releaseLock(); } catch {}
    try { this.writer.releaseLock(); } catch {}
  }
}

function buildMimeMessage(smtp, presentation, payload) {
  const boundary = `cvstudio_${crypto.randomUUID().replaceAll("-", "")}`;
  const subject = payload.subject || defaultSubject();
  const html = buildHtml(presentation, payload);
  const text = buildText(presentation, payload);

  return [
    `From: ${encodeHeader(smtp.fromName)} <${smtp.from}>`,
    `To: <${payload.to}>`,
    `Reply-To: <${smtp.replyTo}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@cvstudio.opentrust.group>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(base64Utf8(text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(base64Utf8(html)),
    `--${boundary}--`
  ].join("\r\n");
}

function dotStuff(message) {
  return message
    .replace(/\r?\n/g, "\r\n")
    .replace(/(^|\r\n)\./g, "$1..");
}

function encodeHeader(value) {
  return `=?UTF-8?B?${base64Utf8(value)}?=`;
}

function base64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function getPresentationConfig(env) {
  return {
    fromName: env.SMTP_FROM_NAME || "Miguel Ángel Carriazo · OpenTrust Group",
    replyTo: env.SMTP_REPLY_TO || env.SMTP_FROM || env.SMTP_USER || "macarriazo@technology-advisory.es"
  };
}

function buildHtml(config, payload) {
  const recipientName = escapeHtml(payload.recipientName || "");
  const greeting = recipientName ? `Hola, ${recipientName}:` : "Hola:";
  const message = escapeHtml(payload.message || "Te envío un acceso privado y temporal a mi vida profesional completa.").replace(/\n/g, "<br>");
  const expiry = formatDate(payload.expiresAt);
  const downloads = Number(payload.maxDownloads || 1);

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(payload.subject || defaultSubject())}</title></head>
<body style="margin:0;padding:0;background:#f3f6f8;font-family:Segoe UI,Arial,sans-serif;color:#172333">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6f8"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #dce5ea;border-radius:14px;overflow:hidden;box-shadow:0 12px 35px rgba(8,31,48,.08)">
<tr><td style="background:#071526;padding:22px 28px"><table role="presentation" width="100%"><tr><td style="color:#ffffff;font-size:18px;font-weight:700">OpenTrust Group</td><td align="right" style="color:#74c7d5;font-size:11px;letter-spacing:1.5px;font-weight:700">VIDA PROFESIONAL</td></tr></table></td></tr>
<tr><td style="padding:34px 34px 18px"><div style="color:#0d7188;font-size:12px;font-weight:700;letter-spacing:1.2px;margin-bottom:10px">ACCESO PRIVADO</div><h1 style="margin:0 0 20px;font-size:26px;line-height:1.25;color:#102033">Miguel Ángel Carriazo Álvarez</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.6">${greeting}</p><p style="margin:0 0 26px;font-size:15px;line-height:1.7;color:#405064">${message}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#0d7188;border-radius:8px"><a href="${escapeAttr(payload.url)}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700">Consultar vida profesional</a></td></tr></table>
<div style="margin-top:26px;padding:16px 18px;background:#f3f8f9;border-left:4px solid #0d7188;border-radius:6px;color:#4e5d6c;font-size:13px;line-height:1.6"><strong style="color:#102033">Acceso temporal y protegido</strong><br>Disponible hasta ${expiry}. El enlace permite ${downloads} descarga${downloads === 1 ? "" : "s"}.</div>
<p style="margin:28px 0 12px;font-size:14px;line-height:1.65;color:#526275;font-weight:600">Un saludo,</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td width="4" style="width:4px;background:#0d7188;font-size:1px;line-height:1px">&nbsp;</td>
<td style="padding:0 0 0 16px">
<div style="font-size:17px;line-height:1.3;font-weight:700;color:#09172b">Miguel Ángel Carriazo</div>
<div style="margin-top:3px;font-size:12px;line-height:1.5;color:#25364d">Arquitectura de Soluciones · Infraestructura · Ciberseguridad · GRC</div>
<div style="margin-top:5px;font-size:12px;line-height:1.5"><a href="mailto:${escapeAttr(config.replyTo)}" style="color:#0d7188;text-decoration:none;font-weight:600">${escapeHtml(config.replyTo)}</a></div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:11px"><tr><td valign="top" style="padding-right:8px;color:#0d7188;font-size:18px;line-height:1">♢</td><td>
<div style="font-size:14px;line-height:1.3"><a href="https://opentrust.group" style="color:#0d7188;text-decoration:none;font-weight:700">OpenTrust Group</a></div>
<div style="margin-top:2px;font-size:11px;line-height:1.5;color:#40567a">Technology Advisory · GRCREAL · FraudeDigital · CyberLibrary AI</div>
</td></tr></table>
<div style="margin-top:12px;font-size:11px;line-height:1.5;color:#40567a"><a href="https://opentrust.group" style="color:#0d7188;text-decoration:none;font-weight:700">opentrust.group</a><span style="padding:0 9px;color:#a6b0bf">|</span><a href="https://www.linkedin.com/in/macarriazo" style="color:#0d7188;text-decoration:none;font-weight:700">LinkedIn</a></div>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 34px 28px"><div style="border-top:1px solid #e2e8ec;padding-top:18px;color:#7a8793;font-size:11px;line-height:1.6">Este mensaje contiene un enlace personal y temporal. Si no esperabas recibirlo, puedes ignorarlo. El destinatario y los datos técnicos de descarga se registran temporalmente con fines de seguridad y trazabilidad, sujetos a la política de retención de CV Studio.</div></td></tr>
<tr><td style="background:#f7f9fa;padding:14px 28px;text-align:center;color:#778592;font-size:11px">opentrust.group · ${escapeHtml(config.replyTo)}</td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(config, payload) {
  const greeting = payload.recipientName ? `Hola, ${payload.recipientName}:` : "Hola:";
  const downloads = Number(payload.maxDownloads || 1);
  return `${greeting}\n\n${payload.message || "Te envío un acceso privado y temporal a mi vida profesional completa."}\n\nConsultar vida profesional:\n${payload.url}\n\nDisponible hasta ${formatDate(payload.expiresAt)}. El enlace permite ${downloads} descarga${downloads === 1 ? "" : "s"}.\n\nUn saludo,\n\nMiguel Ángel Carriazo\nArquitectura de Soluciones · Infraestructura · Ciberseguridad · GRC\n${config.replyTo}\n\nOpenTrust Group\nTechnology Advisory · GRCREAL · FraudeDigital · CyberLibrary AI\nhttps://opentrust.group | https://www.linkedin.com/in/macarriazo\n\nContacto: ${config.replyTo}\n\nPrivacidad: el destinatario y los datos técnicos de descarga se registran temporalmente con fines de seguridad y trazabilidad.`;
}

function defaultSubject() {
  return "Miguel Ángel Carriazo · Vida profesional completa";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
