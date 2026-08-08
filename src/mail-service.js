const DEFAULT_RELAY_URL = "http://127.0.0.1:10061";

export async function sendCvEmail(env, payload) {
  if (String(env.LOCAL_MODE || "").toLowerCase() === "true") {
    return sendThroughLocalRelay(env, payload);
  }

  throw new Error(
    "El envío SMTP directo no está habilitado en producción. Configure el servicio de correo de Cloudflare o un proveedor HTTPS antes del despliegue."
  );
}

export function buildEmailPreview(env, payload) {
  const config = getPresentationConfig(env);
  return {
    subject: payload.subject || defaultSubject(),
    html: buildHtml(config, payload),
    text: buildText(config, payload)
  };
}

async function sendThroughLocalRelay(env, payload) {
  const relayUrl = String(env.LOCAL_MAIL_RELAY_URL || DEFAULT_RELAY_URL).replace(/\/$/, "");
  const relayKey = env.LOCAL_MAIL_RELAY_KEY || "local-development-only";
  const config = getPresentationConfig(env);

  const response = await fetch(`${relayUrl}/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-local-relay-key": relayKey
    },
    body: JSON.stringify({
      to: payload.to,
      subject: payload.subject || defaultSubject(),
      html: buildHtml(config, payload),
      text: buildText(config, payload)
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || `El relay SMTP local respondió con HTTP ${response.status}.`);
  }

  return data;
}

function getPresentationConfig(env) {
  return {
    fromName: env.SMTP_FROM_NAME || "Miguel Ángel Carriazo · OpenTrust Group",
    replyTo: env.SMTP_REPLY_TO || env.SMTP_FROM || env.SMTP_USER || "macarriazo@opentrust.group"
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
<div style="margin-top:5px;font-size:12px;line-height:1.5"><a href="mailto:macarriazo@opentrust.group" style="color:#0d7188;text-decoration:none;font-weight:600">macarriazo@opentrust.group</a></div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:11px"><tr><td valign="top" style="padding-right:8px;color:#0d7188;font-size:18px;line-height:1">♢</td><td>
<div style="font-size:14px;line-height:1.3"><a href="https://opentrust.group" style="color:#0d7188;text-decoration:none;font-weight:700">OpenTrust Group</a></div>
<div style="margin-top:2px;font-size:11px;line-height:1.5;color:#40567a">Technology Advisory · GRCREAL · FraudeDigital · CyberLibrary AI</div>
</td></tr></table>
<div style="margin-top:12px;font-size:11px;line-height:1.5;color:#40567a"><a href="https://opentrust.group" style="color:#0d7188;text-decoration:none;font-weight:700">opentrust.group</a><span style="padding:0 9px;color:#a6b0bf">|</span><a href="https://www.linkedin.com/in/macarriazo" style="color:#0d7188;text-decoration:none;font-weight:700">LinkedIn</a></div>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 34px 28px"><div style="border-top:1px solid #e2e8ec;padding-top:18px;color:#7a8793;font-size:11px;line-height:1.6">Este mensaje contiene un enlace personal y temporal. Si no esperabas recibirlo, puedes ignorarlo. No se almacena la dirección del destinatario en el portal.</div></td></tr>
<tr><td style="background:#f7f9fa;padding:14px 28px;text-align:center;color:#778592;font-size:11px">opentrust.group · ${escapeHtml(config.replyTo)}</td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(config, payload) {
  const greeting = payload.recipientName ? `Hola, ${payload.recipientName}:` : "Hola:";
  const downloads = Number(payload.maxDownloads || 1);
  return `${greeting}\n\n${payload.message || "Te envío un acceso privado y temporal a mi vida profesional completa."}\n\nConsultar vida profesional:\n${payload.url}\n\nDisponible hasta ${formatDate(payload.expiresAt)}. El enlace permite ${downloads} descarga${downloads === 1 ? "" : "s"}.\n\nUn saludo,\n\nMiguel Ángel Carriazo\nArquitectura de Soluciones · Infraestructura · Ciberseguridad · GRC\nmacarriazo@opentrust.group\n\nOpenTrust Group\nTechnology Advisory · GRCREAL · FraudeDigital · CyberLibrary AI\nhttps://opentrust.group | https://www.linkedin.com/in/macarriazo\n\nContacto: ${config.replyTo}`;
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
