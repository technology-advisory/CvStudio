import { buildEmailPreview, sendCvEmail } from "./mail-service.js";
import { sanitizeModel } from "./cv-model.js";
import { renderCvDocument } from "./cv-render.js";
import { requireAdminAccess, verifyRequestOrigin, isLocalRequest } from "./access-auth.js";
import {
  getDraft,
  saveDraft,
  resetDraft,
  renderPreview,
  publishDraft,
  listContentVersions,
  restoreContentVersion,
  deleteContentVersion,
  purgeDownloadEvents
} from "./cv-content.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_PDF_BYTES = 15 * 1024 * 1024;
// El PDF activo siempre se sirve/descarga con este nombre, sin importar cómo
// se llamara el archivo original que se subió. La versión que deja de estar
// activa se renombra (no se borra) para que quede identificable en el
// historial en vez de competir por el mismo nombre.
const CANONICAL_CV_NAME = "CV_Miguel_Angel_Carriazo.pdf";

export default {
  async fetch(request, env) {
    try {
      return secureResponse(await (async () => {
      const url = new URL(request.url);
      const path = url.pathname;

      // Defensa en profundidad: todas las APIs administrativas requieren
      // Cloudflare Access. En local se permite el flujo de desarrollo.
      let admin = null;
      if (path.startsWith("/api/")) {
        admin = await requireAdminAccess(request, env);
        verifyRequestOrigin(request, env);
      }

      // El panel administrativo requiere Access también a nivel Worker.
      if (path === "/app.html" || path === "/dashboard" || path === "/dashboard/") {
        await requireAdminAccess(request, env);
      }

      // Compatibilidad con la antigua URL de login. La portada pública vive en /.
      if (path === "/login.html") return Response.redirect(new URL("/", url), 308);

      // La autenticación del panel se delega en Cloudflare Access.
      // En local no hay login interno: / muestra la portada y /app.html el portal.

      if (path === "/dashboard" || path === "/dashboard/") {
        return Response.redirect(new URL("/app.html", url), 308);
      }

      if (path === "/api/health" && request.method === "GET") {
        return json({ ok: true });
      }

      if (path === "/api/cv" && request.method === "GET") return await getCurrentCv(env);
      if (path === "/api/cv" && request.method === "POST") return await uploadCv(request, env);
      if (path === "/api/cv/preview" && request.method === "GET") return await serveCurrentCv(env, true);
      if (path === "/api/cv/download" && request.method === "GET") return await serveCurrentCv(env, false);

      if (path === "/api/cv/versions" && request.method === "GET") return await listCvVersions(env);

      const activateMatch = path.match(/^\/api\/cv\/versions\/(\d+)\/activate$/);
      if (activateMatch && request.method === "POST") return await activateCvVersion(env, Number(activateMatch[1]));

      const versionDownloadMatch = path.match(/^\/api\/cv\/versions\/(\d+)\/download$/);
      if (versionDownloadMatch && request.method === "GET") return await downloadCvVersion(env, Number(versionDownloadMatch[1]), false);

      const versionPreviewMatch = path.match(/^\/api\/cv\/versions\/(\d+)\/preview$/);
      if (versionPreviewMatch && request.method === "GET") return await downloadCvVersion(env, Number(versionPreviewMatch[1]), true);

      const versionDeleteActionMatch = path.match(/^\/api\/cv\/versions\/(\d+)\/delete$/);
      if (versionDeleteActionMatch && request.method === "POST") return await deleteCvVersion(env, Number(versionDeleteActionMatch[1]));

      // Compatibilidad con versiones anteriores del frontend. El portal actual
      // usa POST /delete para evitar navegaciones/respuestas HTML inesperadas.
      const versionDeleteMatch = path.match(/^\/api\/cv\/versions\/(\d+)$/);
      if (versionDeleteMatch && request.method === "DELETE") return await deleteCvVersion(env, Number(versionDeleteMatch[1]));

      // --- Contenido estructurado del CV -----------------------------------
      if (path === "/api/cv-content" && request.method === "GET") return await getDraft(env);
      if (path === "/api/cv-content" && request.method === "PUT") return await saveDraft(request, env);
      if (path === "/api/cv-content/reset" && request.method === "POST") return await resetDraft(env);
      if (path === "/api/cv-content/render" && request.method === "POST") return await renderPreview(request);
      if (path === "/api/cv-content/pdf" && request.method === "POST") { await enforceRateLimit(env.PDF_RATE_LIMITER, admin?.email || "admin", "pdf"); return await renderPdfWithBrowserRun(request, env); }
      if (path === "/api/cv-content/publish" && request.method === "POST") return await publishDraft(request, env);
      if (path === "/api/cv-content/versions" && request.method === "GET") return await listContentVersions(env);

      const restoreMatch = path.match(/^\/api\/cv-content\/versions\/(\d+)\/restore$/);
      if (restoreMatch && request.method === "POST") return await restoreContentVersion(env, Number(restoreMatch[1]));

      const contentVersionDeleteMatch = path.match(/^\/api\/cv-content\/versions\/(\d+)$/);
      if (contentVersionDeleteMatch && request.method === "DELETE") return await deleteContentVersion(env, Number(contentVersionDeleteMatch[1]));

      if (path === "/api/maintenance/purge" && request.method === "POST") return json(await purgeDownloadEvents(env));

      if (path === "/api/links" && request.method === "GET") return await listLinks(env);
      if (path === "/api/statistics" && request.method === "GET") return await getStatistics(env);
      if (path === "/api/statistics/downloads" && request.method === "DELETE") return await deleteAllDownloadEvents(env);
      if (path === "/api/statistics/downloads/bulk-delete" && request.method === "POST") return await bulkDeleteDownloadEvents(request, env);
      const downloadEventDeleteMatch = path.match(/^\/api\/statistics\/downloads\/(\d+)$/);
      if (downloadEventDeleteMatch && request.method === "DELETE") return await deleteDownloadEvent(env, Number(downloadEventDeleteMatch[1]));
      if (path === "/api/links" && request.method === "POST") return await createLink(request, env, publicBaseUrl(env, url.origin));
      if (path === "/api/mail/preview" && request.method === "POST") return await previewMail(request, env, publicBaseUrl(env, url.origin));
      if (path === "/api/mail-templates" && request.method === "GET") return await listMailTemplates(env);

      const mailTemplateMatch = path.match(/^\/api\/mail-templates\/([a-z0-9_-]+)$/);
      if (mailTemplateMatch && request.method === "PUT") return await updateMailTemplate(request, env, mailTemplateMatch[1]);

      if (path === "/api/send-cv" && request.method === "POST") { await enforceRateLimit(env.SEND_RATE_LIMITER, admin?.email || "admin", "send"); return await createAndSend(request, env, publicBaseUrl(env, url.origin)); }

      const sentMatch = path.match(/^\/api\/links\/(\d+)\/sent$/);
      if (sentMatch && request.method === "POST") return await markLinkSent(request, env, Number(sentMatch[1]));

      const revokeMatch = path.match(/^\/api\/links\/(\d+)\/revoke$/);
      if (revokeMatch && request.method === "POST") return await revokeLink(env, Number(revokeMatch[1]));

      const linkDeleteMatch = path.match(/^\/api\/links\/(\d+)$/);
      if (linkDeleteMatch && request.method === "DELETE") return await deleteLink(env, Number(linkDeleteMatch[1]));
      if (path === "/api/links/bulk-delete" && request.method === "POST") return await bulkDeleteLinks(request, env);
      if (path === "/api/links/revoke-all" && request.method === "POST") return await revokeAllActiveLinks(env);
      if (path === "/api/links/purge" && request.method === "POST") return await purgeOldLinks(request, env);

      const downloadFileMatch = path.match(/^\/download\/([A-Za-z0-9_-]{20,})\/file$/);
      if (downloadFileMatch && request.method === "GET") return await consumeDownload(request, env, downloadFileMatch[1]);
      const downloadMatch = path.match(/^\/download\/([A-Za-z0-9_-]{20,})$/);
      // Descarga directa: valida el token, registra trazabilidad y devuelve el PDF
      // sin mostrar una página HTML intermedia. Se mantiene /file por compatibilidad.
      if (downloadMatch && request.method === "GET") return await consumeDownload(request, env, downloadMatch[1]);

      if (path.startsWith("/api/")) return json({ error: "No encontrado" }, 404);
      return await env.ASSETS.fetch(request);
      })(), request);
    } catch (error) {
      console.error(error);
      const status = Number(error?.status) || 500;
      return secureResponse(json({ error: status >= 500 ? "Error interno" : error.message }, status), request);
    }
  },

  /** Cron de retención: borra los datos personales de descarga caducados. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      purgeDownloadEvents(env)
        .then((result) => console.log("retention purge", JSON.stringify(result)))
        .catch((error) => console.error("retention purge failed", error))
    );
  }
};

async function renderPdfWithBrowserRun(request, env) {
  if (!env.BROWSER || typeof env.BROWSER.quickAction !== "function") {
    throw httpError("Browser Run no está configurado en este Worker.", 503);
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") throw httpError("Petición JSON inválida.", 400);
  const model = sanitizeModel(payload.model ?? payload);
  const html = renderCvDocument(model, "print");
  if (new TextEncoder().encode(html).byteLength > 2 * 1024 * 1024) {
    throw httpError("El documento es demasiado grande para generar el PDF.", 413);
  }

  const result = await env.BROWSER.quickAction("pdf", {
    html,
    pdfOptions: {
      format: "a4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    }
  });
  if (!result.ok) {
    console.error("Browser Run PDF failed", result.status, await result.text().catch(() => ""));
    throw httpError("No se pudo generar el PDF.", 502);
  }
  const pdf = await result.arrayBuffer();
  const signature = new Uint8Array(pdf.slice(0, 5));
  const isPdf = signature.length === 5 && signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46 && signature[4] === 0x2d;
  if (!isPdf) throw httpError("No se pudo generar un PDF válido.", 502);
  return secureResponse(new Response(pdf, { status: 200, headers: {
    "content-type": "application/pdf", "cache-control": "no-store",
    "content-disposition": "inline; filename=CV_Miguel_Angel_Carriazo.pdf"
  }}), request);
}

async function getCurrentCv(env) {
  const row = await activeCv(env);
  if (!row) {
    const seeded = await env.CV_BUCKET.head("cv/full/current.pdf");
    if (!seeded) return json({ exists: false });
    return json({ exists: true, seededOnly: true, fileName: CANONICAL_CV_NAME, version: "Inicial local", updatedAt: null, fileSize: seeded.size });
  }
  return json({
    exists: true,
    id: row.id,
    type: row.cv_type,
    version: row.version,
    fileName: row.file_name,
    fileSize: row.file_size,
    checksum: row.checksum_sha256,
    updatedAt: row.created_at
  });
}

/**
 * Mantiene el invariante: la versión activa siempre se llama
 * CANONICAL_CV_NAME. Si otra fila ya tenía ese nombre (la que se está
 * sustituyendo como activa), se renombra con su versión y fecha para que
 * quede identificable en el historial en vez de desaparecer o chocar de
 * nombre con la nueva.
 */
async function claimCanonicalName(env, cvType, activeId) {
  const holder = await env.DB.prepare(
    "SELECT id, version, created_at FROM cv_versions WHERE cv_type = ? AND file_name = ? AND id != ? AND deleted_at IS NULL"
  )
    .bind(cvType, CANONICAL_CV_NAME, activeId)
    .first();

  if (holder) {
    await env.DB.prepare("UPDATE cv_versions SET file_name = ? WHERE id = ?")
      .bind(archivedFileName(holder.version, holder.created_at), holder.id)
      .run();
  }

  await env.DB.prepare("UPDATE cv_versions SET file_name = ? WHERE id = ?").bind(CANONICAL_CV_NAME, activeId).run();
}

function archivedFileName(version, createdAt) {
  const stamp = (createdAt || new Date().toISOString()).slice(0, 10);
  const label = cleanOptionalText(version, 40)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `CV_Miguel_Angel_Carriazo_${label ? `${label}-${stamp}` : stamp}.pdf`;
}

async function uploadCv(request, env) {
  const form = await request.formData();
  const file = form.get("file");
  const version = cleanText(form.get("version") || new Date().toISOString().slice(0, 10), 40);
  const cvType = cleanText(form.get("type") || "full", 24);
  const activate = form.get("activate") !== "false";

  if (!(file instanceof File)) return json({ error: "Selecciona un archivo PDF." }, 400);
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return json({ error: "El archivo debe ser PDF." }, 400);
  if (file.size < 5 || file.size > MAX_PDF_BYTES) return json({ error: "El PDF debe ocupar entre 5 bytes y 15 MB." }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return json({ error: "El archivo no contiene una cabecera PDF válida." }, 400);

  const checksum = await sha256Hex(bytes);
  const now = new Date().toISOString();
  const current = await activeCv(env, cvType);
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
  const key = `cv/${cvType}/${now.replace(/[:.]/g, "-")}-${safeName}`;

  await env.CV_BUCKET.put(key, bytes, { httpMetadata: { contentType: "application/pdf", contentDisposition: `inline; filename="${safeName}"` }, customMetadata: { version, checksum } });

  const statements = [];
  if (activate) {
    statements.push(env.DB.prepare("UPDATE cv_versions SET is_active = 0 WHERE cv_type = ? AND is_active = 1").bind(cvType));
  }
  statements.push(
    env.DB.prepare(`INSERT INTO cv_versions
      (cv_type, version, r2_key, file_name, file_size, checksum_sha256, created_at, is_active, previous_version_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(cvType, version, key, file.name, file.size, checksum, now, activate ? 1 : 0, current?.id ?? null)
  );

  const result = await env.DB.batch(statements);
  const insertResult = result[result.length - 1];
  const newId = insertResult.meta.last_row_id;

  if (activate) await claimCanonicalName(env, cvType, newId);

  return json({ ok: true, id: newId, version, fileName: activate ? CANONICAL_CV_NAME : file.name, updatedAt: now, activated: activate });
}

async function serveCurrentCv(env, inline) {
  const row = await activeCv(env);
  const key = row?.r2_key || "cv/full/current.pdf";
  const object = await env.CV_BUCKET.get(key);
  if (!object) return json({ error: "No hay un CV disponible." }, 404);
  const fileName = row?.file_name || CANONICAL_CV_NAME;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "application/pdf");
  headers.set("content-disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  headers.set("cache-control", "private, no-store");
  return secureResponse(new Response(object.body, { headers }), request);
}

/** Historial de versiones subidas (activa e inactivas), sin las eliminadas. */
async function listCvVersions(env, cvType = "full") {
  const { results } = await env.DB.prepare(
    `SELECT id, version, file_name, file_size, created_at, is_active
     FROM cv_versions WHERE cv_type = ? AND deleted_at IS NULL ORDER BY id DESC`
  )
    .bind(cvType)
    .all();
  return json({ versions: results || [] });
}

/** Pone esta versión como la activa (la que reciben los nuevos enlaces). No borra ninguna otra. */
async function activateCvVersion(env, id) {
  const row = await env.DB.prepare("SELECT id, cv_type, deleted_at FROM cv_versions WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "Versión no encontrada." }, 404);
  if (row.deleted_at) return json({ error: "Esta versión fue eliminada." }, 410);

  await env.DB.batch([
    env.DB.prepare("UPDATE cv_versions SET is_active = 0 WHERE cv_type = ? AND is_active = 1").bind(row.cv_type),
    env.DB.prepare("UPDATE cv_versions SET is_active = 1 WHERE id = ?").bind(id)
  ]);
  await claimCanonicalName(env, row.cv_type, id);
  return json({ ok: true, id });
}

/**
 * Borrado manual y explícito de una versión: libera el PDF en R2 y la oculta
 * del historial. Nunca borra la versión activa (hay que activar otra antes)
 * ni la fila en D1, porque download_links puede seguir apuntando a ella.
 */
async function deleteCvVersion(env, id) {
  const row = await env.DB.prepare("SELECT id, r2_key, is_active, deleted_at FROM cv_versions WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "Versión no encontrada." }, 404);
  if (row.deleted_at) return json({ ok: true, id });
  if (row.is_active) return json({ error: "No puedes eliminar la versión activa. Activa otra primero." }, 409);

  await env.CV_BUCKET.delete(row.r2_key).catch(() => {});
  await env.DB.prepare("UPDATE cv_versions SET deleted_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
  return json({ ok: true, id });
}

/** Descarga/previsualiza una versión concreta del historial (no necesariamente la activa). */
async function downloadCvVersion(env, id, inline) {
  const row = await env.DB.prepare("SELECT r2_key, file_name, deleted_at FROM cv_versions WHERE id = ?").bind(id).first();
  if (!row || row.deleted_at) return json({ error: "Versión no disponible." }, 404);
  const object = await env.CV_BUCKET.get(row.r2_key);
  if (!object) return json({ error: "El archivo ya no está disponible en el almacenamiento." }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "application/pdf");
  headers.set("content-disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.file_name)}`);
  headers.set("cache-control", "private, no-store");
  return secureResponse(new Response(object.body, { headers }), request);
}


function publicBaseUrl(env, fallbackOrigin) {
  // En PRE/local el enlace del correo debe apuntar al mismo origen desde el que
  // se está ejecutando CV Studio. En PRO usamos PUBLIC_BASE_URL.
  try {
    const fallback = new URL(fallbackOrigin);
    const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
    if (localHosts.has(fallback.hostname)) {
      return fallback.origin.replace(/\/+$/, "");
    }
  } catch {
    // Si el origen no fuese parseable, seguimos con la configuración habitual.
  }

  const configured = String(env.PUBLIC_BASE_URL || "").trim();
  const base = configured || fallbackOrigin;
  return base.replace(/\/+$/, "");
}


async function createLink(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const result = await createLinkRecord(body, env, origin);
  return json({ ok: true, ...result }, 201);
}

async function listMailTemplates(env) {
  const { results } = await env.DB.prepare(`SELECT template_key, name, description, subject, message, updated_at
    FROM mail_templates ORDER BY CASE template_key WHEN 'selection' THEN 1 WHEN 'executive' THEN 2 ELSE 99 END, template_key`).all();
  return json({ templates: results || [] });
}

async function updateMailTemplate(request, env, templateKey) {
  if (!/^[a-z0-9_-]{2,40}$/.test(templateKey)) throw httpError("Plantilla no válida.", 400);
  const body = await request.json().catch(() => ({}));
  const name = cleanOptionalText(body.name, 80);
  const description = cleanOptionalText(body.description, 180);
  const subject = cleanOptionalText(body.subject, 160);
  const message = cleanOptionalText(body.message, 3000);
  if (!name || !description || !subject || !message) throw httpError("Completa todos los campos de la plantilla.", 400);
  const updatedAt = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE mail_templates
    SET name = ?, description = ?, subject = ?, message = ?, updated_at = ?
    WHERE template_key = ?`)
    .bind(name, description, subject, message, updatedAt, templateKey).run();
  if (!Number(result.meta?.changes || 0)) throw httpError("La plantilla no existe.", 404);
  return json({ ok: true, template: { template_key: templateKey, name, description, subject, message, updated_at: updatedAt } });
}

async function createAndSend(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const to = validateEmail(body.to);
  const recipientName = cleanOptionalText(body.recipientName, 80);
  const subject = cleanOptionalText(body.subject, 160) || "Miguel Ángel Carriazo · Vida profesional completa";
  const message = cleanOptionalText(body.message, 2000) || "Te envío un acceso privado y temporal a mi vida profesional completa.";
  const result = await createLinkRecord(body, env, origin);

  try {
    await sendCvEmail(env, { to, recipientName, subject, message, ...result });
    await env.DB.prepare(`UPDATE download_links
      SET sent_at = ?, recipient_email = COALESCE(?, recipient_email),
          recipient_name = COALESCE(?, recipient_name), email_subject = COALESCE(?, email_subject)
      WHERE id = ?`)
      .bind(new Date().toISOString(), to, recipientName || null, subject, result.id).run();
  } catch (error) {
    console.error("SMTP send failed", error);
    await env.DB.prepare(`UPDATE download_links
      SET status = 'REVOKED', revoked_at = ?
      WHERE id = ? AND status = 'ACTIVE'`)
      .bind(new Date().toISOString(), result.id).run();

    return json({
      error: "No se pudo enviar el correo. El enlace generado se ha revocado automáticamente."
    }, 502);
  }

  return json({ ok: true, sent: true, ...result }, 201);
}

async function previewMail(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : resolveExpiry(body);
  const maxDownloads = 1;
  const preview = buildEmailPreview(env, {
    recipientName: cleanOptionalText(body.recipientName, 80),
    subject: cleanOptionalText(body.subject, 160),
    message: cleanOptionalText(body.message, 2000),
    url: typeof body.url === "string" && body.url.startsWith(origin + "/download/")
      ? body.url
      : `${origin}/download/ENLACE-SEGURO-DE-EJEMPLO`,
    expiresAt,
    maxDownloads
  });
  return json(preview);
}

async function createLinkRecord(body, env, origin) {
  const current = await activeCv(env);
  const seeded = current ? null : await env.CV_BUCKET.head("cv/full/current.pdf");
  if (!current && !seeded) throw httpError("Sube primero un CV antes de generar enlaces.", 409);

  const expiresAt = resolveExpiry(body);
  // Una descarga real permitida. Los accesos clasificados como automatizados
  // se registran para trazabilidad, pero no consumen esta descarga.
  const maxDownloads = 1;
  const token = randomToken(32);
  const tokenHash = await sha256Hex(new TextEncoder().encode(token));
  const tokenHint = `${token.slice(0, 5)}…${token.slice(-4)}`;
  const createdAt = new Date().toISOString();
  const cvVersionId = current?.id ?? await ensureSeedRecord(env, seeded);
  const recipientEmail = cleanOptionalEmail(body.to);
  const recipientName = cleanOptionalText(body.recipientName, 80);
  const emailSubject = cleanOptionalText(body.subject, 160);

  const insert = await env.DB.prepare(`INSERT INTO download_links
    (token_hash, token_hint, cv_version_id, created_at, expires_at, status, max_downloads, download_count, recipient_email, recipient_name, email_subject)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, 0, ?, ?, ?)`)
    .bind(tokenHash, tokenHint, cvVersionId, createdAt, expiresAt, maxDownloads, recipientEmail, recipientName, emailSubject).run();

  return { id: insert.meta.last_row_id, url: `${origin}/download/${token}`, tokenHint, createdAt, expiresAt, maxDownloads };
}

function resolveExpiry(body) {
  if (body.expiresAt) {
    const custom = new Date(body.expiresAt);
    if (Number.isNaN(custom.getTime()) || custom <= new Date()) throw httpError("La fecha de caducidad debe ser futura.", 400);
    return custom.toISOString();
  }
  const minutes = Number(body.minutes || 60);
  if (![30, 60, 1440].includes(minutes)) throw httpError("Caducidad no válida.", 400);
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function listLinks(env) {
  await expireLinks(env);
  const { results } = await env.DB.prepare(`SELECT l.id, l.token_hint, l.created_at, l.expires_at, l.status,
      l.used_at, l.revoked_at, l.max_downloads, l.download_count,
      l.recipient_email, l.recipient_name, l.email_subject, l.sent_at,
      c.version AS cv_version, c.file_name AS cv_file_name
    FROM download_links l
    JOIN cv_versions c ON c.id = l.cv_version_id
    ORDER BY l.id DESC LIMIT 250`).all();
  return json({ links: results });
}

async function markLinkSent(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const sentAt = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE download_links
    SET sent_at = ?, recipient_email = COALESCE(?, recipient_email),
        recipient_name = COALESCE(?, recipient_name), email_subject = COALESCE(?, email_subject)
    WHERE id = ?`)
    .bind(sentAt, cleanOptionalEmail(body.to) || null, cleanOptionalText(body.recipientName, 80) || null, cleanOptionalText(body.subject, 160) || null, id).run();
  if (!result.meta.changes) return json({ error: "El enlace no existe." }, 404);
  return json({ ok: true, sentAt });
}

async function getStatistics(env) {
  await expireLinks(env);
  const summary = await env.DB.prepare(`SELECT
      COUNT(*) AS total_links,
      SUM(CASE WHEN sent_at IS NOT NULL THEN 1 ELSE 0 END) AS total_sent,
      SUM(download_count) AS total_downloads,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_links
    FROM download_links`).first();

  const { results: sends } = await env.DB.prepare(`SELECT
      l.id, l.token_hint, l.recipient_email, l.recipient_name, l.email_subject,
      l.created_at, l.sent_at, l.expires_at, l.status, l.max_downloads, l.download_count,
      c.version AS cv_version, c.file_name AS cv_file_name
    FROM download_links l
    JOIN cv_versions c ON c.id = l.cv_version_id
    WHERE l.recipient_email IS NOT NULL OR l.sent_at IS NOT NULL
    ORDER BY l.id DESC LIMIT 250`).all();

  const { results: downloads } = await env.DB.prepare(`SELECT
      e.id, e.downloaded_at, e.ip_address, e.country, e.city, e.user_agent,
      e.asn, e.as_organization, e.classification, e.classification_reason,
      l.id AS link_id, l.token_hint, l.recipient_email, l.recipient_name,
      c.version AS cv_version, c.file_name AS cv_file_name
    FROM download_events e
    JOIN download_links l ON l.id = e.link_id
    JOIN cv_versions c ON c.id = l.cv_version_id
    ORDER BY e.id DESC LIMIT 250`).all();

  return json({ summary, sends, downloads });
}

async function deleteDownloadEvent(env, id) {
  const result = await env.DB.prepare("DELETE FROM download_events WHERE id = ?").bind(id).run();
  if (!result.meta.changes) return json({ error: "El registro no existe." }, 404);
  return json({ ok: true, deleted: Number(result.meta.changes || 0) });
}

async function bulkDeleteDownloadEvents(request, env) {
  const body = await request.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))].slice(0, 250);
  if (!ids.length) throw httpError("Selecciona al menos un registro.", 400);
  const placeholders = ids.map(() => "?").join(",");
  const result = await env.DB.prepare(`DELETE FROM download_events WHERE id IN (${placeholders})`).bind(...ids).run();
  return json({ ok: true, deleted: Number(result.meta.changes || 0) });
}

async function deleteAllDownloadEvents(env) {
  const result = await env.DB.prepare("DELETE FROM download_events").run();
  return json({ ok: true, deleted: Number(result.meta.changes || 0) });
}

function downloadMetadata(request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  const ipAddress = forwarded.split(",")[0].trim() || null;
  const cf = request.cf || {};
  const event = {
    ipAddress,
    country: cleanOptionalText(cf.country || "", 80) || null,
    city: cleanOptionalText(cf.city || "", 120) || null,
    userAgent: cleanOptionalText(request.headers.get("user-agent") || "", 500) || null,
    asn: Number.isFinite(Number(cf.asn)) ? Number(cf.asn) : null,
    asOrganization: cleanOptionalText(cf.asOrganization || "", 160) || null
  };
  return { ...event, ...classifyAccessEvent(event) };
}

function classifyAccessEvent(event) {
  const ua = String(event.userAgent || "").toLowerCase();
  const org = String(event.asOrganization || "").toLowerCase();
  const uaSignals = ["bot", "crawler", "spider", "scanner", "headless", "safelinks", "urlscan", "proofpoint", "mimecast", "barracuda", "defender"];
  const orgSignals = ["microsoft", "azure", "proofpoint", "mimecast", "barracuda", "zscaler", "forcepoint", "cloudflare", "amazon", "google cloud"];
  const uaSignal = uaSignals.find(value => ua.includes(value));
  const orgSignal = orgSignals.find(value => org.includes(value));
  if (uaSignal || orgSignal) {
    const reason = uaSignal ? `Señal técnica en User-Agent: ${uaSignal}` : `Infraestructura cloud/seguridad: ${event.asOrganization}`;
    return { classification: "POSSIBLE_AUTOMATION", classificationReason: reason };
  }
  // No afirmamos que sea humano únicamente por no detectar un scanner.
  return { classification: "UNDETERMINED", classificationReason: null };
}

async function revokeLink(env, id) {
  const result = await env.DB.prepare(`UPDATE download_links
    SET status = 'REVOKED', revoked_at = ?
    WHERE id = ? AND status = 'ACTIVE'`).bind(new Date().toISOString(), id).run();
  if (!result.meta.changes) return json({ error: "El enlace no está activo o no existe." }, 409);
  return json({ ok: true });
}


async function revokeAllActiveLinks(env) {
  const result = await env.DB.prepare(`UPDATE download_links
    SET status = 'REVOKED', revoked_at = ?
    WHERE status = 'ACTIVE'`).bind(new Date().toISOString()).run();
  return json({ ok: true, revoked: Number(result?.meta?.changes || 0) });
}

async function deleteLink(env, id) {
  const row = await env.DB.prepare("SELECT id FROM download_links WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "El enlace no existe." }, 404);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM download_events WHERE link_id = ?").bind(id),
    env.DB.prepare("DELETE FROM download_links WHERE id = ?").bind(id)
  ]);
  return json({ ok: true, deleted: 1 });
}

async function bulkDeleteLinks(request, env) {
  const body = await request.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))].slice(0, 250);
  if (!ids.length) throw httpError("Selecciona al menos un enlace.", 400);
  const placeholders = ids.map(() => "?").join(",");
  const results = await env.DB.batch([
    env.DB.prepare(`DELETE FROM download_events WHERE link_id IN (${placeholders})`).bind(...ids),
    env.DB.prepare(`DELETE FROM download_links WHERE id IN (${placeholders})`).bind(...ids)
  ]);
  return json({ ok: true, deleted: Number(results?.[1]?.meta?.changes || 0) });
}

async function purgeOldLinks(request, env) {
  const body = await request.json().catch(() => ({}));
  const days = Number(body.days);
  if (![7, 30, 90, 180, 365].includes(days)) throw httpError("Periodo de eliminación no válido.", 400);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  // La limpieza por antigüedad nunca destruye accesos que sigan activos.
  // Para invalidarlos de forma masiva existe la acción explícita "Revocar todos".
  const candidates = await env.DB.prepare(`SELECT id FROM download_links
    WHERE created_at <= ? AND status IN ('EXPIRED','USED','REVOKED')`).bind(cutoff).all();
  const ids = (candidates.results || []).map(row => Number(row.id)).filter(Number.isInteger);
  if (!ids.length) return json({ ok: true, deleted: 0, days, reason: 'NO_OLD_LINKS' });
  let deleted = 0;
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const placeholders = chunk.map(() => "?").join(",");
    const results = await env.DB.batch([
      env.DB.prepare(`DELETE FROM download_events WHERE link_id IN (${placeholders})`).bind(...chunk),
      env.DB.prepare(`DELETE FROM download_links WHERE id IN (${placeholders})`).bind(...chunk)
    ]);
    deleted += Number(results?.[1]?.meta?.changes || 0);
  }
  return json({ ok: true, deleted, days });
}

async function consumeDownload(request, env, token) {
  const tokenHash = await sha256Hex(new TextEncoder().encode(token));
  const row = await env.DB.prepare(`SELECT l.*, c.r2_key, c.file_name
    FROM download_links l JOIN cv_versions c ON c.id = l.cv_version_id
    WHERE l.token_hash = ?`).bind(tokenHash).first();

  if (!row) return publicError("Enlace no válido", "El enlace no existe o ya no está disponible.", 404);

  const now = new Date();
  if (row.status === "REVOKED") {
    return publicError("Enlace revocado", "Este enlace ha sido invalidado por el propietario.", 410);
  }
  if (new Date(row.expires_at) <= now) {
    await env.DB.prepare("UPDATE download_links SET status = 'EXPIRED' WHERE id = ?").bind(row.id).run();
    return publicError("Enlace caducado", "La fecha de validez de este enlace ha finalizado.", 410);
  }

  const event = downloadMetadata(request);
  const isAutomatic = event.classification === "POSSIBLE_AUTOMATION";
  const currentCount = Number(row.download_count || 0);
  const maxDownloads = Math.max(1, Number(row.max_downloads || 1));

  // Un acceso humano/no determinado sí consume la descarga disponible.
  // Un acceso con señales de scanner se registra, pero NO consume el enlace.
  if (!isAutomatic && (row.status === "USED" || currentCount >= maxDownloads)) {
    return publicError("Enlace utilizado", "Este enlace ya alcanzó su número máximo de descargas.", 410);
  }

  const object = await env.CV_BUCKET.get(row.r2_key);
  if (!object) {
    return publicError("Documento no disponible", "El CV asociado no se encuentra en el almacenamiento.", 404);
  }

  const nextCount = isAutomatic ? currentCount : currentCount + 1;
  const nextStatus = !isAutomatic && nextCount >= maxDownloads ? "USED" : "ACTIVE";
  const usedAt = !isAutomatic ? now.toISOString() : row.used_at;

  await env.DB.batch([
    env.DB.prepare(`UPDATE download_links
      SET download_count = ?, status = ?, used_at = ?
      WHERE id = ?`)
      .bind(nextCount, nextStatus, usedAt || null, row.id),
    env.DB.prepare(`INSERT INTO download_events
      (link_id, downloaded_at, ip_address, country, city, user_agent, asn, as_organization, classification, classification_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        row.id,
        now.toISOString(),
        event.ipAddress,
        event.country,
        event.city,
        event.userAgent,
        event.asn,
        event.asOrganization,
        event.classification,
        event.classificationReason
      )
  ]);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "application/pdf");
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`);
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("x-content-type-options", "nosniff");
  return secureResponse(new Response(object.body, { headers }), request);
}

async function activeCv(env, cvType = "full") {
  return env.DB.prepare("SELECT * FROM cv_versions WHERE cv_type = ? AND is_active = 1 ORDER BY id DESC LIMIT 1").bind(cvType).first();
}

async function ensureSeedRecord(env, seededHead) {
  const existing = await activeCv(env);
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const checksum = seededHead?.customMetadata?.checksum || "seed-local";
  const result = await env.DB.prepare(`INSERT INTO cv_versions
    (cv_type, version, r2_key, file_name, file_size, checksum_sha256, created_at, is_active)
    VALUES ('full', 'Inicial local', 'cv/full/current.pdf', 'CV_Miguel_Angel_Carriazo.pdf', ?, ?, ?, 1)`)
    .bind(seededHead?.size || 0, checksum, now).run();
  return result.meta.last_row_id;
}

async function expireLinks(env) {
  await env.DB.prepare("UPDATE download_links SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expires_at <= ?")
    .bind(new Date().toISOString()).run();
}

function randomToken(bytes) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(data) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function enforceRateLimit(binding, actor, scope) {
  if (!binding || typeof binding.limit !== "function") return;
  const { success } = await binding.limit({ key: `${scope}:${actor}` });
  if (!success) throw httpError("Demasiadas solicitudes. Inténtalo de nuevo en un minuto.", 429);
}

function secureResponse(response, request = null) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set("cross-origin-resource-policy", "same-origin");
  const local = request ? isLocalRequest(request) : false;
  headers.set("content-security-policy", local
    ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:10062 http://localhost:10062; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if (request && !local && new URL(request.url).protocol === "https:") headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cleanText(value, max) {
  return String(value).trim().slice(0, max) || "Sin versión";
}

function validateEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) throw httpError("Introduce una dirección de correo válida.", 400);
  return email;
}

function cleanOptionalEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254 ? email : null;
}

function cleanOptionalText(value, max) {
  return String(value || "").trim().slice(0, max);
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, "cache-control": "no-store", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "referrer-policy": "no-referrer" } });
}

function publicError(title, message, status) {
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{margin:0;font-family:Inter,system-ui;background:#f4f7f9;color:#0a1728;display:grid;place-items:center;min-height:100vh}.card{max-width:560px;margin:24px;background:white;border:1px solid #dce6eb;border-radius:22px;padding:40px;box-shadow:0 22px 60px #06263b18}.brand{color:#0d7188;font-weight:800;letter-spacing:.08em;font-size:.78rem}h1{margin:.8rem 0}.muted{color:#5c6b79;line-height:1.6}</style></head><body><main class="card"><div class="brand">OPENTRUST GROUP</div><h1>${title}</h1><p class="muted">${message}</p></main></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
