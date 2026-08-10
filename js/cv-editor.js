/**
 * Editor estructurado del CV.
 *
 * No edita HTML: edita el modelo de datos. La maquetación la pone el servidor
 * (src/cv-render.js), así que no se puede romper desde aquí — sólo cambiar el
 * contenido. La vista previa es A4 real, con las líneas de corte de página.
 */

const A4_PX = 1122.52; // 297 mm a 96 dpi
const $ = (selector, root = document) => root.querySelector(selector);

const state = {
  model: null,
  dirty: false,
  saving: false,
  lastFocusedTextarea: null
};

let previewTimer = null;
let autosaveTimer = null;

export function initCvEditor() {
  if (!$("#cv-content-form")) return;
  bindToolbar();
  loadModel();
}

/* ------------------------------------------------------------------ API --- */

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  if (response.status === 401) {
    location.href = "/";
    throw new Error("Sesión caducada");
  }
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : await response.text();
  if (!response.ok) throw new Error(payload?.error || "Error inesperado");
  return payload;
}

async function loadModel() {
  setStatus("Cargando contenido…");
  try {
    const data = await api("/api/cv-content");
    state.model = data.model;
    renderForm();
    refreshPreview();
    setStatus(data.seeded ? "Contenido inicial cargado" : `Borrador del ${formatDate(data.updatedAt)}`);
  } catch (error) {
    setStatus(`No se pudo cargar: ${error.message}`);
  }
}

async function saveDraft({ silent = false } = {}) {
  if (!state.model || state.saving) return;
  state.saving = true;
  if (!silent) setStatus("Guardando…");
  try {
    const data = await api("/api/cv-content", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: state.model })
    });
    state.dirty = false;
    setStatus(`Borrador guardado · ${formatDate(data.updatedAt)}`);
    if (!silent) toast("Borrador guardado en el servidor");
  } catch (error) {
    setStatus(`No se pudo guardar: ${error.message}`);
  } finally {
    state.saving = false;
  }
}

async function resetModel() {
  if (!confirm("¿Restaurar el contenido original? Se pierde el borrador guardado.")) return;
  try {
    const data = await api("/api/cv-content/reset", { method: "POST" });
    state.model = data.model;
    renderForm();
    refreshPreview();
    setStatus("Contenido original restaurado");
  } catch (error) {
    setStatus(`No se pudo restaurar: ${error.message}`);
  }
}

async function publish() {
  const version = prompt("Nombre de esta versión (para encontrarla luego):", defaultVersionLabel());
  if (!version) return;
  setStatus("Guardando versión con nombre…");
  try {
    await saveDraft({ silent: true });
    const data = await api("/api/cv-content/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version, model: state.model })
    });
    setStatus(`Versión «${data.version}» guardada en el historial · ${formatDate(data.updatedAt)}`);
    toast('Guardada. Para publicarla: "Exportar PDF" y súbelo en Documento.');
  } catch (error) {
    setStatus(`No se pudo guardar la versión: ${error.message}`);
    alert(`No se pudo guardar la versión.\n\n${error.message}`);
  }
}

async function exportPdf() {
  if (!state.model) return;

  setStatus("Generando PDF…");
  try {
    // La exportación usa el mismo motor PDF que "Publicar en Documento".
    // Evitamos window.print(), que puede añadir fecha, título, URL y numeración.
    const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";

    let html = null;
    if (isLocal) {
      html = await api("/api/cv-content/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: state.model, mode: "print" })
      });
    }

    const pdfEndpoint = isLocal
      ? "http://127.0.0.1:10062/render-pdf"
      : "/api/cv-content/pdf";

    const response = await fetch(pdfEndpoint, {
      method: "POST",
      credentials: isLocal ? "omit" : "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isLocal ? { html } : { model: state.model })
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      let message = "No se pudo generar el PDF.";
      try {
        if (contentType.includes("application/json")) {
          const data = await response.json();
          message = data?.error || message;
        } else {
          const text = await response.text();
          if (text) message = text;
        }
      } catch {}
      throw new Error(message);
    }

    const blob = await response.blob();
    if (!blob.type.includes("pdf") && blob.size < 5) {
      throw new Error("La respuesta del servidor no contiene un PDF válido.");
    }

    const fileName = state.model.meta?.pdfFileName || "CV_Miguel_Angel_Carriazo.pdf";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    setStatus("PDF generado");
    toast("PDF generado y descargado");
  } catch (error) {
    setStatus(`No se pudo exportar: ${error.message}`);
    toast(`No se pudo exportar: ${error.message}`);
  }
}

/**
 * "Publicar en Documento": guarda primero el contenido como una versión
 * identificable y después lleva al módulo Documento. La exportación/impresión
 * queda reservada exclusivamente al botón "Exportar PDF".
 */
async function publishToDocument() {
  const version = prompt("Nombre de esta versión (quedará en Documento):", defaultVersionLabel());
  if (!version) return;

  setStatus("Publicando PDF en Documento…");
  try {
    // 1) Persistimos el contenido editable y su versión lógica.
    await saveDraft({ silent: true });
    const published = await api("/api/cv-content/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version, model: state.model })
    });

    // 2) Renderizamos EXACTAMENTE la misma plantilla que usa Exportar PDF.
    const html = await api("/api/cv-content/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: state.model, mode: "print" })
    });

    // 3) Mismo flujo en ambos entornos, cambiando únicamente el motor PDF:
    //    - LOCAL: Edge/Chrome headless en 127.0.0.1:10062.
    //    - PRO: Cloudflare Browser Run mediante /api/cv-content/pdf.
    const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    const pdfEndpoint = isLocal
      ? "http://127.0.0.1:10062/render-pdf"
      : "/api/cv-content/pdf";

    const renderResponse = await fetch(pdfEndpoint, {
      method: "POST",
      credentials: isLocal ? "omit" : "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isLocal ? { html } : { model: state.model })
    });
    if (!renderResponse.ok) {
      const detail = await renderResponse.text().catch(() => "");
      throw new Error(detail || "No se pudo generar el PDF automáticamente.");
    }
    const pdfBlob = await renderResponse.blob();

    // 4) Subimos el PDF generado a la MISMA colección que muestra Documento,
    // como Backup. Así aparece en «Versiones subidas» inmediatamente.
    const safeVersion = String(published.version || version)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "version";
    const fileName = `CV_Miguel_Angel_Carriazo_${safeVersion}.pdf`;
    const pdfFile = new File([pdfBlob], fileName, { type: "application/pdf" });
    const form = new FormData();
    form.append("file", pdfFile);
    form.append("version", published.version || version);
    form.append("type", "full");
    form.append("activate", "false");

    const uploadResponse = await fetch("/api/cv", {
      method: "POST",
      credentials: "same-origin",
      body: form
    });
    const uploadPayload = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      throw new Error(uploadPayload.error || "No se pudo registrar el PDF en Documento.");
    }

    const versionInput = document.querySelector("#cv-version-input");
    if (versionInput) versionInput.value = "";

    document.dispatchEvent(new CustomEvent("cv-document-published", {
      detail: { id: uploadPayload.id, version: published.version || version }
    }));
    setStatus(`Versión «${published.version || version}» publicada en Documento`);
    toast("PDF publicado como Backup. Ya puedes ponerlo como primario.");
    location.hash = "document";
  } catch (error) {
    setStatus(`No se pudo publicar: ${error.message}`);
    alert(`No se pudo publicar en Documento.\n\n${error.message}`);
  }
}


/* -------------------------------------------------------------- Preview --- */

function refreshPreview({ keepScroll = true } = {}) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const frame = $("#cv-live-preview");
    if (!frame || !state.model) return;
    const scrollY = keepScroll ? frame.contentWindow?.scrollY || 0 : 0;
    try {
      const html = await api("/api/cv-content/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: state.model, mode: "preview" })
      });
      frame.srcdoc = html;
      frame.addEventListener(
        "load",
        () => {
          decoratePreview();
          wireEditableRegions();
          if (scrollY) frame.contentWindow?.scrollTo(0, scrollY);
        },
        { once: true }
      );
    } catch (error) {
      setStatus(`Vista previa no disponible: ${error.message}`);
    }
  }, 500);
}

/** Dibuja los cortes de página sobre la vista previa y cuenta las páginas. */
function decoratePreview() {
  const frame = $("#cv-live-preview");
  const doc = frame?.contentDocument;
  if (!doc?.body) return;

  const height = doc.body.scrollHeight;
  const pages = Math.max(1, Math.ceil(height / A4_PX));

  doc.querySelectorAll(".page-ruler").forEach((el) => el.remove());
  doc.body.style.position = "relative";
  for (let page = 1; page < pages; page += 1) {
    const ruler = doc.createElement("div");
    ruler.className = "page-ruler";
    ruler.style.cssText = `position:absolute;left:0;right:0;top:${page * A4_PX}px;border-top:1px dashed #cbd5e1;`;
    const label = doc.createElement("span");
    label.textContent = `Página ${page + 1}`;
    label.style.cssText =
      "position:absolute;right:2px;top:2px;font-size:7pt;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase;";
    ruler.appendChild(label);
    doc.body.appendChild(ruler);
  }

  const badge = $("#cv-page-count");
  if (badge) {
    const overflow = height - (pages - 1) * A4_PX;
    const fill = Math.round((overflow / A4_PX) * 100);
    badge.textContent = `${pages} ${pages === 1 ? "página" : "páginas"} · última al ${fill}%`;
    badge.classList.toggle("warn", pages > 4);
  }
}

/* ----------------------------------------------------- Edición inline --- */

/** Lee un valor del modelo por ruta "a.b.2.c". */
function getAtPath(obj, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[/^\d+$/.test(key) ? Number(key) : key]), obj);
}

/** Escribe un valor del modelo por ruta "a.b.2.c". Devuelve false si la ruta no existe. */
function setAtPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((node, key) => (node == null ? undefined : node[/^\d+$/.test(key) ? Number(key) : key]), obj);
  if (target == null) return false;
  target[/^\d+$/.test(last) ? Number(last) : last] = value;
  return true;
}

/** HTML editado (con <b>/<strong>) de vuelta a texto plano con **negrita**. */
function htmlToModelText(html) {
  return html
    .replace(/<\/(div|p|li)>/gi, "")
    .replace(/<(div|p|li)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<(b|strong)>/gi, "**")
    .replace(/<\/(b|strong)>/gi, "**")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Un contenedor "list" (ul de viñetas, o div de párrafos/líneas) a array de strings. */
function htmlListToModelArray(container, itemSelector) {
  const items = [...container.children].filter((el) => el.matches(itemSelector));
  return items.map((el) => htmlToModelText(el.innerHTML));
}

/** Activa la edición inline sobre todos los nodos [data-cv-path] del iframe. */
function wireEditableRegions() {
  const frame = $("#cv-live-preview");
  const doc = frame?.contentDocument;
  const badge = $("#cv-inline-status");
  if (!doc?.body) {
    if (badge) badge.textContent = "Edición inline: no se pudo acceder a la vista previa";
    return;
  }

  const nodes = [...doc.querySelectorAll("[data-cv-path]")];
  let wired = 0;

  nodes.forEach((el) => {
    el.dataset.cvWired = "true";
    el.contentEditable = "true";
    el.setAttribute("spellcheck", "true");
    if (el.isContentEditable) wired += 1;

    const kind = el.dataset.cvKind || "text";

    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && kind === "text") {
        event.preventDefault();
        el.blur();
      }
      if (event.key === "Escape") el.blur();
    });

    el.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      doc.execCommand("insertText", false, text);
    });

    el.addEventListener("blur", () => commitEdit(el, kind));
  });

  if (badge) {
    badge.textContent =
      nodes.length === 0
        ? "Edición inline: 0 campos detectados (avísame si ves esto)"
        : wired === nodes.length
          ? `Edición inline: ${wired} campos listos — haz clic en cualquier texto`
          : `Edición inline: ${wired}/${nodes.length} campos activados (revisar)`;
  }
}

function commitEdit(el, kind) {
  const path = el.dataset.cvPath;
  if (!path || !state.model) return;

  let value;
  if (kind === "list") {
    const itemSelector = el.tagName === "UL" ? "li" : el.classList.contains("claim") ? ".claim-line" : "p";
    value = htmlListToModelArray(el, itemSelector);
  } else {
    value = htmlToModelText(el.innerHTML);
  }

  const previous = getAtPath(state.model, path);
  if (JSON.stringify(previous) === JSON.stringify(value)) return;

  if (!setAtPath(state.model, path, value)) return;
  renderForm();
  markChanged();
}

function markChanged() {
  state.dirty = true;
  setStatus("Cambios sin guardar");
  refreshPreview();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveDraft({ silent: true }), 4000);
}

function renderForm() {
  const root = $("#cv-content-form");
  if (!root || !state.model) return;
  const scroll = root.scrollTop;
  root.innerHTML = "";
  const { meta } = state.model;

  root.appendChild(
    block("Cabecera", [
      field("Marca", meta.brandLead, (v) => (meta.brandLead = v)),
      field("Descriptor de marca", meta.brandTail, (v) => (meta.brandTail = v)),
      field("Nombre", meta.name, (v) => (meta.name = v)),
      field("Titular profesional", meta.role, (v) => (meta.role = v)),
      listEditor("Datos de contacto", meta.contact, (items) => (meta.contact = items), { short: true }),
      field("Pie del documento", meta.footer, (v) => (meta.footer = v), { multiline: true }),
      field("Nombre del archivo PDF", meta.pdfFileName, (v) => (meta.pdfFileName = v), { short: true })
    ])
  );

  root.appendChild(
    block("Titular destacado", [listEditor("Líneas", state.model.claim, (items) => (state.model.claim = items))])
  );

  root.appendChild(
    block("Perfil", [
      listEditor("Párrafos", state.model.summary, (items) => (state.model.summary = items), { multiline: true }),
      field("Título del bloque de foco", state.model.focus.title, (v) => (state.model.focus.title = v)),
      listEditor("Puntos de foco", state.model.focus.items, (items) => (state.model.focus.items = items)),
      field("Frase de cierre", state.model.closing, (v) => (state.model.closing = v), { multiline: true })
    ])
  );

  state.model.sections.forEach((section, index) => root.appendChild(sectionEditor(section, index)));
  root.scrollTop = scroll;
}

function sectionEditor(section, index) {
  const children = [
    field("Título de la sección", section.title, (v) => (section.title = v))
  ];

  if (section.type === "experience") {
    section.jobs.forEach((job, jobIndex) => {
      children.push(
        subBlock(
          job.company || `Puesto ${jobIndex + 1}`,
          [
            field("Empresa", job.company, (v) => (job.company = v)),
            field("Ubicación", job.place, (v) => (job.place = v), { short: true }),
            field("Fechas", job.dates, (v) => (job.dates = v), { short: true }),
            field("Cargo / subtítulo", job.subrole, (v) => (job.subrole = v)),
            field("Introducción", job.intro, (v) => (job.intro = v), { multiline: true }),
            field("Nota en cursiva", job.meta, (v) => (job.meta = v), { multiline: true }),
            field("Etiqueta", job.tag, (v) => (job.tag = v), { short: true }),
            listEditor("Responsabilidades", job.bullets, (items) => (job.bullets = items), { multiline: true }),
            ...job.roles.map((role, roleIndex) =>
              subBlock(
                role.title || `Cargo ${roleIndex + 1}`,
                [
                  field("Cargo", role.title, (v) => (role.title = v)),
                  field("Fechas", role.dates, (v) => (role.dates = v), { short: true }),
                  listEditor("Responsabilidades", role.bullets, (items) => (role.bullets = items), { multiline: true })
                ],
                () => removeAt(job.roles, roleIndex)
              )
            ),
            addButton("Añadir cargo dentro de esta empresa", () => {
              job.roles.push({ title: "Nuevo cargo", dates: "", bullets: [] });
              renderForm();
              markChanged();
            })
          ],
          () => removeAt(section.jobs, jobIndex),
          { move: (dir) => moveAt(section.jobs, jobIndex, dir) }
        )
      );
    });
    children.push(
      addButton("Añadir empresa", () => {
        section.jobs.push({ company: "Nueva empresa", place: "", dates: "", subrole: "", intro: "", meta: "", tag: "", bullets: [], roles: [] });
        renderForm();
        markChanged();
      })
    );
  }

  if (section.type === "bullets") {
    children.push(listEditor("Viñetas", section.bullets, (items) => (section.bullets = items), { multiline: true }));
  }

  if (section.type === "groups") {
    section.groups.forEach((group, groupIndex) =>
      children.push(
        subBlock(
          group.title || `Grupo ${groupIndex + 1}`,
          [
            field("Título", group.title, (v) => (group.title = v)),
            field("Introducción", group.intro, (v) => (group.intro = v), { multiline: true }),
            listEditor("Viñetas", group.bullets, (items) => (group.bullets = items), { multiline: true })
          ],
          () => removeAt(section.groups, groupIndex),
          { move: (dir) => moveAt(section.groups, groupIndex, dir) }
        )
      )
    );
    children.push(
      addButton("Añadir grupo", () => {
        section.groups.push({ title: "Nuevo grupo", intro: "", bullets: [] });
        renderForm();
        markChanged();
      })
    );
  }

  if (section.type === "certs") {
    section.columns.forEach((column, columnIndex) => {
      column.forEach((group, groupIndex) =>
        children.push(
          subBlock(
            `${group.title || "Grupo"} · columna ${columnIndex + 1}`,
            [
              field("Título", group.title, (v) => (group.title = v)),
              certItemsEditor(group)
            ],
            () => removeAt(column, groupIndex),
            { move: (dir) => moveAt(column, groupIndex, dir) }
          )
        )
      );
      children.push(
        addButton(`Añadir grupo a la columna ${columnIndex + 1}`, () => {
          column.push({ title: "Nuevo grupo", items: [] });
          renderForm();
          markChanged();
        })
      );
    });
  }

  if (section.type === "blocks") {
    section.blocks.forEach((blockItem, blockIndex) =>
      children.push(
        subBlock(
          blockItem.title || `Bloque ${blockIndex + 1}`,
          [
            field("Título", blockItem.title, (v) => (blockItem.title = v)),
            field("Texto", blockItem.text, (v) => (blockItem.text = v), { multiline: true }),
            listEditor("Viñetas", blockItem.bullets, (items) => (blockItem.bullets = items), { multiline: true })
          ],
          () => removeAt(section.blocks, blockIndex),
          { move: (dir) => moveAt(section.blocks, blockIndex, dir) }
        )
      )
    );
    children.push(
      addButton("Añadir bloque", () => {
        section.blocks.push({ title: "Nuevo bloque", text: "", bullets: [] });
        renderForm();
        markChanged();
      })
    );
  }

  if (section.type === "projects") {
    children.push(
      field("Columnas (2-4)", String(section.columns), (v) => (section.columns = Number(v) || 4), { short: true })
    );
    section.items.forEach((item, itemIndex) =>
      children.push(
        subBlock(
          item.name || `Proyecto ${itemIndex + 1}`,
          [
            field("Nombre", item.name, (v) => (item.name = v)),
            field("URL", item.url, (v) => (item.url = v), { short: true }),
            field("Descripción", item.desc, (v) => (item.desc = v), { multiline: true })
          ],
          () => removeAt(section.items, itemIndex),
          { move: (dir) => moveAt(section.items, itemIndex, dir) }
        )
      )
    );
    children.push(
      addButton("Añadir proyecto", () => {
        section.items.push({ name: "Nuevo proyecto", url: "", desc: "" });
        renderForm();
        markChanged();
      })
    );
  }

  return block(`${String(index + 1).padStart(2, "0")} · ${section.title}`, children, {
    move: (dir) => moveAt(state.model.sections, index, dir)
  });
}

function certItemsEditor(group) {
  const wrap = document.createElement("div");
  wrap.className = "cert-items";
  group.items.forEach((item, itemIndex) => {
    wrap.appendChild(
      subBlock(
        item.text.slice(0, 48) || `Certificación ${itemIndex + 1}`,
        [
          field("Certificación", item.text, (v) => (item.text = v), { multiline: true }),
          listEditor("Detalle", item.sub, (items) => (item.sub = items))
        ],
        () => removeAt(group.items, itemIndex),
        { move: (dir) => moveAt(group.items, itemIndex, dir) }
      )
    );
  });
  wrap.appendChild(
    addButton("Añadir certificación", () => {
      group.items.push({ text: "Nueva certificación", sub: [] });
      renderForm();
      markChanged();
    })
  );
  return wrap;
}

/* ------------------------------------------------------------- Controles --- */

function block(title, children, options = {}) {
  const details = document.createElement("details");
  details.className = "editor-block";
  details.open = false;
  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${escapeHtml(title)}</span>`;
  if (options.move) {
    summary.appendChild(moveControls(options.move));
  }
  details.appendChild(summary);
  const body = document.createElement("div");
  body.className = "editor-block-body";
  children.filter(Boolean).forEach((child) => body.appendChild(child));
  details.appendChild(body);
  return details;
}

function subBlock(title, children, onRemove, options = {}) {
  const details = document.createElement("details");
  details.className = "editor-subblock";
  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${escapeHtml(title)}</span>`;
  const tools = document.createElement("span");
  tools.className = "row-tools";
  if (options.move) tools.appendChild(moveControls(options.move));
  if (onRemove) {
    const remove = iconButton("Eliminar", "×");
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      if (!confirm("¿Eliminar este bloque?")) return;
      onRemove();
      renderForm();
      markChanged();
    });
    tools.appendChild(remove);
  }
  summary.appendChild(tools);
  details.appendChild(summary);
  const body = document.createElement("div");
  body.className = "editor-block-body";
  children.filter(Boolean).forEach((child) => body.appendChild(child));
  details.appendChild(body);
  return details;
}

function field(label, value, onInput, options = {}) {
  const wrap = document.createElement("label");
  wrap.className = `editor-field${options.short ? " short" : ""}`;
  wrap.appendChild(labelNode(label));
  const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
  if (options.multiline) input.rows = Math.min(8, Math.max(2, Math.ceil((value || "").length / 90)));
  input.value = value ?? "";
  input.addEventListener("input", () => {
    onInput(input.value);
    markChanged();
  });
  input.addEventListener("focus", () => (state.lastFocusedTextarea = input));
  wrap.appendChild(input);
  return wrap;
}

function listEditor(label, items, onChange, options = {}) {
  const wrap = document.createElement("div");
  wrap.className = "editor-list";
  wrap.appendChild(labelNode(label));

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "editor-row";
    const input = options.multiline || !options.short ? document.createElement("textarea") : document.createElement("input");
    if (input.tagName === "TEXTAREA") input.rows = Math.min(6, Math.max(1, Math.ceil((item || "").length / 80)));
    input.value = item;
    input.addEventListener("input", () => {
      items[index] = input.value;
      onChange(items);
      markChanged();
    });
    input.addEventListener("focus", () => (state.lastFocusedTextarea = input));
    row.appendChild(input);

    const tools = document.createElement("div");
    tools.className = "row-tools";
    tools.appendChild(
      moveControls((dir) => {
        moveAt(items, index, dir);
        onChange(items);
      })
    );
    const remove = iconButton("Eliminar", "×");
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      items.splice(index, 1);
      onChange(items);
      renderForm();
      markChanged();
    });
    tools.appendChild(remove);
    row.appendChild(tools);
    wrap.appendChild(row);
  });

  wrap.appendChild(
    addButton("Añadir línea", () => {
      items.push("");
      onChange(items);
      renderForm();
      markChanged();
    })
  );
  return wrap;
}

function labelNode(text) {
  const span = document.createElement("span");
  span.className = "editor-label";
  span.textContent = text;
  return span;
}

function moveControls(handler) {
  const group = document.createElement("span");
  group.className = "move-group";
  [["↑", -1], ["↓", 1]].forEach(([glyph, direction]) => {
    const button = iconButton(direction < 0 ? "Subir" : "Bajar", glyph);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler(direction);
      renderForm();
      markChanged();
    });
    group.appendChild(button);
  });
  return group;
}

function iconButton(title, glyph) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "row-btn";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.textContent = glyph;
  return button;
}

function addButton(text, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "add-btn";
  button.textContent = `+ ${text}`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    handler();
  });
  return button;
}

/* --------------------------------------------------------------- Toolbar --- */

function bindToolbar() {
  $("#cv-save")?.addEventListener("click", () => saveDraft());
  $("#cv-reset")?.addEventListener("click", resetModel);
  $("#cv-publish")?.addEventListener("click", publish);
  $("#cv-publish-document")?.addEventListener("click", publishToDocument);
  $("#cv-export")?.addEventListener("click", exportPdf);
  $("#cv-bold")?.addEventListener("click", wrapSelectionBold);
  $("#cv-expand-all")?.addEventListener("click", () => toggleAll(true));
  $("#cv-collapse-all")?.addEventListener("click", () => toggleAll(false));
  window.addEventListener("beforeunload", (event) => {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}

function toggleAll(open) {
  document.querySelectorAll("#cv-content-form details").forEach((el) => (el.open = open));
}

function wrapSelectionBold() {
  const input = state.lastFocusedTextarea;
  if (!input) return toast("Selecciona antes el texto que quieres poner en negrita.");
  const { selectionStart: start, selectionEnd: end, value } = input;
  if (start === end) return toast("Selecciona texto dentro de un campo.");
  input.value = `${value.slice(0, start)}**${value.slice(start, end)}**${value.slice(end)}`;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

/* ---------------------------------------------------------------- Utils --- */

function removeAt(array, index) {
  array.splice(index, 1);
}

function moveAt(array, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= array.length) return;
  const [item] = array.splice(index, 1);
  array.splice(target, 0, item);
}

function setStatus(message) {
  const el = $("#cv-editor-status");
  if (el) el.textContent = message;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function defaultVersionLabel() {
  return new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(message) {
  const el = document.querySelector("#toast");
  if (!el) return alert(message);
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
