/**
 * Contenido del CV: borrador e historial de versiones con nombre.
 *
 * El borrador ya no vive en localStorage del navegador: vive en D1. Cada vez
 * que guardas una "versión con nombre" queda un snapshot exacto del
 * contenido en ese momento, restaurable más adelante.
 *
 * La generación del PDF final es manual y deliberada: "Exportar PDF" abre
 * el diálogo de impresión del navegador con la maquetación exacta del
 * servidor, y desde "Documento" lo subes como versión activa. Así evitamos
 * depender de Browser Rendering (Cloudflare, función de pago que solo
 * funciona desplegada o con 'wrangler dev --remote') para poder editar y
 * publicar el CV en local sin fricción.
 */

import { cloneDefaultModel, sanitizeModel } from "./cv-model.js";
import { renderCvDocument } from "./cv-render.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

export async function loadDraft(env) {
  const row = await env.DB.prepare("SELECT content_json, updated_at FROM cv_content WHERE id = 1").first();
  if (!row) return { model: cloneDefaultModel(), updatedAt: null, seeded: true };
  try {
    return { model: sanitizeModel(JSON.parse(row.content_json)), updatedAt: row.updated_at, seeded: false };
  } catch {
    return { model: cloneDefaultModel(), updatedAt: row.updated_at, seeded: true };
  }
}

export async function getDraft(env) {
  const draft = await loadDraft(env);
  return json(draft);
}

export async function saveDraft(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Modelo no válido." }, 400);

  const model = sanitizeModel(body.model ?? body);
  const now = new Date().toISOString();
  const payload = JSON.stringify(model);
  if (payload.length > 400_000) return json({ error: "El contenido supera el tamaño máximo." }, 413);

  await env.DB.prepare(
    `INSERT INTO cv_content (id, content_json, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET content_json = excluded.content_json, updated_at = excluded.updated_at`
  )
    .bind(payload, now)
    .run();

  return json({ ok: true, updatedAt: now, model });
}

export async function resetDraft(env) {
  const model = cloneDefaultModel();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO cv_content (id, content_json, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET content_json = excluded.content_json, updated_at = excluded.updated_at`
  )
    .bind(JSON.stringify(model), now)
    .run();
  return json({ ok: true, model, updatedAt: now });
}

/** Devuelve el HTML maquetado del modelo recibido, para la vista previa A4 y para exportar. */
export async function renderPreview(request) {
  const body = await request.json().catch(() => ({}));
  const model = sanitizeModel(body.model ?? body);
  const mode = body.mode === "print" ? "print" : "preview";
  return new Response(renderCvDocument(model, mode), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

/**
 * Guarda el contenido actual como versión con nombre en el historial
 * (cv_content_versions). No genera PDF ni toca R2/cv_versions: eso sigue
 * pasando en "Documento", subiendo el PDF exportado desde el navegador.
 */
export async function publishDraft(request, env) {
  const body = await request.json().catch(() => ({}));
  const stored = await loadDraft(env);
  const model = body.model ? sanitizeModel(body.model) : stored.model;
  const version = String(body.version || new Date().toISOString().slice(0, 10)).trim().slice(0, 40);
  const now = new Date().toISOString();
  const payload = JSON.stringify(model);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO cv_content (id, content_json, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET content_json = excluded.content_json, updated_at = excluded.updated_at`
    ).bind(payload, now),
    env.DB.prepare(
      `INSERT INTO cv_content_versions (version, content_json, r2_key, created_at) VALUES (?, ?, NULL, ?)`
    ).bind(version, payload, now)
  ]);

  return json({ ok: true, version, updatedAt: now });
}

export async function listContentVersions(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, version, r2_key, created_at FROM cv_content_versions ORDER BY id DESC LIMIT 30"
  ).all();
  return json({ versions: results || [] });
}

export async function restoreContentVersion(env, id) {
  const row = await env.DB.prepare("SELECT content_json FROM cv_content_versions WHERE id = ?").bind(id).first();
  if (!row) return json({ error: "Versión no encontrada." }, 404);
  const model = sanitizeModel(JSON.parse(row.content_json));
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO cv_content (id, content_json, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET content_json = excluded.content_json, updated_at = excluded.updated_at`
  )
    .bind(JSON.stringify(model), now)
    .run();
  return json({ ok: true, model, updatedAt: now });
}

/** Purga de datos personales de descargas según política de retención. */
export async function purgeDownloadEvents(env) {
  const days = Number(env.RETENTION_DAYS) || 90;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const result = await env.DB.prepare("DELETE FROM download_events WHERE downloaded_at < ?").bind(cutoff).run();
  return { days, cutoff, deleted: result.meta?.changes ?? 0 };
}
