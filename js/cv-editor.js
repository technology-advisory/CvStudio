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
  loadContentVersions();
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

async function saveSafetySnapshot(reason = "cambio") {
  if (!state.model) return null;
  const stamp = new Date().toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
  const labels = {
    import: "Backup antes de importar",
    restore: "Backup antes de restaurar",
    reset: "Backup antes de reset",
    blank: "Backup antes de vaciar borrador"
  };
  const version = `${labels[reason] || "Backup automático"} · ${stamp}`.slice(0, 40);
  const data = await api("/api/cv-content/publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version, model: state.model })
  });
  await loadContentVersions({ silent: true });
  return data;
}

async function resetModel() {
  if (!confirm("¿Restaurar el contenido original? CV Studio guardará antes una copia de seguridad automática del borrador actual.")) return;
  try {
    setStatus("Creando copia de seguridad…");
    await saveSafetySnapshot("reset");
    const data = await api("/api/cv-content/reset", { method: "POST" });
    state.model = data.model;
    state.dirty = false;
    renderForm();
    refreshPreview();
    setStatus("Contenido original restaurado · copia anterior guardada");
    toast("Contenido original restaurado. El borrador anterior quedó guardado como versión.");
  } catch (error) {
    setStatus(`No se pudo restaurar: ${error.message}`);
  }
}

async function loadContentVersions({ silent = false } = {}) {
  const select = $("#cv-version-select");
  const restoreButton = $("#cv-restore-version");
  const deleteButton = $("#cv-delete-version");
  if (!select) return;
  try {
    const data = await api("/api/cv-content/versions");
    const versions = Array.isArray(data.versions) ? data.versions : [];
    const previous = select.value;
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = versions.length ? "Selecciona una versión guardada" : "No hay versiones guardadas";
    select.appendChild(placeholder);
    versions.forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = `${item.version} · ${formatDate(item.created_at)}`;
      select.appendChild(option);
    });
    if (versions.some((item) => String(item.id) === previous)) select.value = previous;
    if (restoreButton) restoreButton.disabled = !select.value;
    if (deleteButton) deleteButton.disabled = !select.value;
    if (!silent && versions.length) toast(`${versions.length} versiones guardadas disponibles`);
  } catch (error) {
    select.innerHTML = '<option value="">No se pudo cargar el historial</option>';
    if (restoreButton) restoreButton.disabled = true;
    if (deleteButton) deleteButton.disabled = true;
    if (!silent) setStatus(`No se pudo cargar el historial: ${error.message}`);
  }
}

async function deleteNamedVersion() {
  const select = $("#cv-version-select");
  const id = Number(select?.value || 0);
  if (!id) return toast("Selecciona primero una versión guardada.");
  const label = select.options[select.selectedIndex]?.textContent || "la versión seleccionada";
  if (!confirm(`¿Eliminar ${label}?\n\nSolo se elimina esta versión guardada. El borrador activo y los PDF publicados no se modifican.`)) return;
  try {
    setStatus("Eliminando versión guardada…");
    await api(`/api/cv-content/versions/${id}`, { method: "DELETE" });
    await loadContentVersions({ silent: true });
    setStatus("Versión eliminada");
    toast("Versión guardada eliminada. El borrador activo se conserva.");
  } catch (error) {
    setStatus(`No se pudo eliminar la versión: ${error.message}`);
    alert(`No se pudo eliminar la versión.\n\n${error.message}`);
  }
}

async function restoreNamedVersion() {
  const select = $("#cv-version-select");
  const id = Number(select?.value || 0);
  if (!id) return toast("Selecciona primero una versión guardada.");
  const label = select.options[select.selectedIndex]?.textContent || "la versión seleccionada";
  if (!confirm(`¿Restaurar ${label} como borrador actual?\n\nAntes se guardará automáticamente una copia del borrador vigente.`)) return;
  try {
    setStatus("Guardando copia de seguridad y restaurando…");
    await saveSafetySnapshot("restore");
    const data = await api(`/api/cv-content/versions/${id}/restore`, { method: "POST" });
    state.model = data.model;
    state.dirty = false;
    renderForm();
    refreshPreview({ keepScroll: false });
    setStatus(`Versión restaurada · ${formatDate(data.updatedAt)}`);
    toast("Versión restaurada como borrador actual. El borrador anterior quedó guardado.");
    await loadContentVersions({ silent: true });
  } catch (error) {
    setStatus(`No se pudo restaurar la versión: ${error.message}`);
    alert(`No se pudo restaurar la versión.\n\n${error.message}`);
  }
}

function blankModelFromCurrent(model) {
  const blank = deepClone(model);

  // Conservamos la estructura (tipos, secciones y número de elementos) para que
  // el editor siga siendo utilizable y el importador legacy pueda mapear por posición.
  blank.meta = {
    ...(blank.meta || {}),
    brandLead: blank.meta?.brandLead || "OpenTrust Group",
    brandTail: blank.meta?.brandTail || "",
    name: "",
    role: "",
    contact: [],
    footer: "",
    pdfFileName: blank.meta?.pdfFileName || "CV_Miguel_Angel_Carriazo.pdf"
  };
  blank.claim = [];
  blank.summary = [];
  blank.focus = { title: "", items: [] };
  blank.closing = "";

  blank.sections = (blank.sections || []).map((section) => {
    const out = { id: section.id, title: section.title, type: section.type };
    if (section.type === "experience") {
      out.jobs = (section.jobs || []).map((job) => ({
        company: "", place: "", dates: "", subrole: "", intro: "", meta: "", tag: "", bullets: [],
        roles: (job.roles || []).map(() => ({ title: "", dates: "", bullets: [] }))
      }));
    } else if (section.type === "bullets") out.bullets = [];
    else if (section.type === "groups") {
      out.groups = (section.groups || []).map(() => ({ title: "", intro: "", bullets: [] }));
    } else if (section.type === "certs") {
      out.columns = (section.columns || [[], []]).map((column) =>
        (column || []).map(() => ({ title: "", items: [] }))
      );
    } else if (section.type === "blocks") {
      out.blocks = (section.blocks || []).map(() => ({ title: "", text: "", bullets: [] }));
    } else if (section.type === "projects") {
      out.intro = "";
      out.columns = section.columns || 4;
      out.items = (section.items || []).map(() => ({ name: "", url: "", desc: "" }));
    }
    return out;
  });
  return blank;
}

async function newBlankDraft() {
  if (!state.model) return;
  if (!confirm("¿Crear un borrador en blanco?\n\nSe vaciará el borrador activo, pero antes se guardará automáticamente una versión de seguridad. Las versiones guardadas y los PDF publicados no se eliminan.")) return;
  try {
    setStatus("Guardando copia de seguridad…");
    await saveSafetySnapshot("blank");
    state.model = blankModelFromCurrent(state.model);
    await saveDraft({ silent: true });
    state.dirty = false;
    renderForm();
    refreshPreview({ keepScroll: false });
    setStatus("Borrador activo en blanco");
    toast("Borrador activo vaciado. La copia anterior quedó guardada como versión.");
  } catch (error) {
    setStatus(`No se pudo crear el borrador en blanco: ${error.message}`);
    alert(`No se pudo crear el borrador en blanco.\n\n${error.message}`);
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
    await loadContentVersions({ silent: true });
    toast("Versión guardada. Puedes restaurarla cuando quieras desde el historial del editor.");
  } catch (error) {
    setStatus(`No se pudo guardar la versión: ${error.message}`);
    alert(`No se pudo guardar la versión.\n\n${error.message}`);
  }
}

async function exportHtml() {
  if (!state.model) return;
  setStatus("Generando HTML…");
  try {
    await saveDraft({ silent: true });
    const html = await api("/api/cv-content/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: state.model, mode: "preview" })
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const base = String(state.model.meta?.pdfFileName || "CV_Miguel_Angel_Carriazo.pdf")
      .replace(/\.pdf$/i, "") || "CV_Miguel_Angel_Carriazo";
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${base}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus("HTML exportado");
    toast("HTML del borrador actual exportado. Puedes reimportarlo posteriormente.");
  } catch (error) {
    setStatus(`No se pudo exportar HTML: ${error.message}`);
    toast(`No se pudo exportar HTML: ${error.message}`);
  }
}

async function exportPdf() {
  if (!state.model) return;

  setStatus("Generando PDF…");
  try {
    // Usar SIEMPRE el generador PDF de CV Studio.
    // No usar window.print(): el diálogo de impresión del navegador
    // puede insertar fecha, título, URL/about:blank y número de página.
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
      const detail = await response.text().catch(() => "");
      throw new Error(detail || "No se pudo generar el PDF.");
    }

    const pdfBlob = await response.blob();
    const bytes = new Uint8Array(await pdfBlob.slice(0, 5).arrayBuffer());
    const signature = String.fromCharCode(...bytes);
    if (signature !== "%PDF-") throw new Error("El servidor no devolvió un PDF válido.");

    const fileName = state.model.meta?.pdfFileName || "CV_Miguel_Angel_Carriazo.pdf";
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    setStatus("PDF generado");
    toast("PDF generado sin cabeceras ni pies del navegador");
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
    // como Primario. Así los nuevos enlaces de email apuntan al PDF limpio generado por CV Studio.
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
    form.append("activate", "true");

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
    toast("PDF publicado como Primario. Los nuevos envíos usarán esta versión limpia.");
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
      field("Introducción", section.intro || "", (v) => (section.intro = v), { multiline: true }),
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


/* --------------------------------------------------------------- Import HTML --- */

async function importHtmlFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return toast("El HTML supera el límite de 5 MB.");
  if (!state.model) return toast("Espera a que termine de cargar el borrador.");
  if (!confirm("¿Importar este HTML como nuevo borrador activo?\n\nCV Studio guardará automáticamente una copia del borrador actual antes de sustituirlo.")) return;

  setStatus("Guardando copia de seguridad…");
  try {
    await saveSafetySnapshot("import");
    setStatus("Importando HTML…");
    const html = await file.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc?.body) throw new Error("No se pudo leer el HTML.");

    let imported = null;
    const structuredCount = doc.querySelectorAll("[data-cv-path]").length;
    if (structuredCount >= 5) imported = importStructuredHtml(doc, state.model);
    else imported = importLegacyHtml(doc, state.model);

    if (!imported?.model || imported.recognized < 5) {
      throw new Error("El HTML no parece corresponder a una plantilla compatible de CV Studio.");
    }

    state.model = imported.model;
    state.dirty = true;
    renderForm();
    refreshPreview();
    await saveDraft({ silent: true });
    setStatus(`HTML importado · ${imported.recognized} campos recuperados · borrador anterior guardado`);
    await loadContentVersions({ silent: true });
    toast(`HTML importado correctamente (${imported.recognized} campos). El borrador anterior quedó guardado como versión.`);
  } catch (error) {
    setStatus(`No se pudo importar: ${error.message}`);
    alert(`No se pudo importar el HTML.\n\n${error.message}`);
  } finally {
    const input = $("#cv-import-html-file");
    if (input) input.value = "";
  }
}

function importStructuredHtml(doc, currentModel) {
  const model = deepClone(currentModel);
  let recognized = 0;

  for (const node of doc.querySelectorAll("[data-cv-path]")) {
    const path = node.getAttribute("data-cv-path");
    if (!path) continue;
    const kind = node.getAttribute("data-cv-kind") || "text";
    const value = kind === "list" ? readListNode(node) : richTextFromNode(node);
    if ((Array.isArray(value) && value.length) || (!Array.isArray(value) && String(value).trim())) {
      if (setPathValue(model, path, value)) recognized++;
    }
  }

  recognized += importCommonHeader(doc, model);
  return { model, recognized };
}

function importLegacyHtml(doc, currentModel) {
  const model = deepClone(currentModel);
  let recognized = importCommonHeader(doc, model);

  const claim = doc.querySelector("#cv-preview-claim, .claim");
  if (claim) {
    const lines = Array.from(claim.querySelectorAll(".claim-line"));
    const values = lines.length ? lines.map(richTextFromNode) : textLines(claim);
    if (values.length) { model.claim = values; recognized++; }
  }

  const summary = Array.from(doc.querySelectorAll(".summary p")).filter((p) => !p.closest("section"));
  if (summary.length) {
    const closing = doc.querySelector("#cv-preview-closing");
    model.summary = summary.filter((p) => p !== closing).map(richTextFromNode).filter(Boolean);
    if (model.summary.length) recognized++;
  }

  const focus = doc.querySelector(".focus");
  if (focus) {
    const title = focus.querySelector(".t");
    const items = Array.from(focus.querySelectorAll("li")).map(richTextFromNode).filter(Boolean);
    if (title) { model.focus.title = richTextFromNode(title); recognized++; }
    if (items.length) { model.focus.items = items; recognized++; }
  }

  const closing = doc.querySelector("#cv-preview-closing");
  if (closing) { model.closing = richTextFromNode(closing); recognized++; }

  const htmlSections = Array.from(doc.querySelectorAll("body > section"));
  model.sections.forEach((sectionModel, index) => {
    const sectionEl = htmlSections[index];
    if (!sectionEl) return;
    const title = sectionEl.querySelector("h2");
    if (title) {
      const clone = title.cloneNode(true);
      clone.querySelector(".num")?.remove();
      const t = richTextFromNode(clone);
      if (t) { sectionModel.title = t; recognized++; }
    }
    recognized += importLegacySection(sectionEl, sectionModel);
  });

  const foot = doc.querySelector(".foot");
  if (foot) { model.meta.footer = richTextFromNode(foot); recognized++; }
  return { model, recognized };
}

function importCommonHeader(doc, model) {
  let count = 0;
  const name = doc.querySelector('[data-cv-path="meta.name"], #cv-preview-name, .head h1');
  const role = doc.querySelector('[data-cv-path="meta.role"], #cv-preview-role, .head .role');
  const contact = doc.querySelector(".head .contact, .contact");
  const brandbar = doc.querySelector(".brandbar");

  if (name) { model.meta.name = richTextFromNode(name); count++; }
  if (role) { model.meta.role = richTextFromNode(role); count++; }
  if (contact) {
    const parts = Array.from(contact.childNodes)
      .filter((n) => !(n.nodeType === 1 && n.classList?.contains("sep")))
      .map((n) => n.nodeType === 3 ? n.textContent.trim() : richTextFromNode(n))
      .filter(Boolean);
    if (parts.length >= 2) { model.meta.contact = parts.map(stripBold); count++; }
  }
  if (brandbar) {
    const tail = brandbar.querySelector("span");
    if (tail) {
      model.meta.brandTail = richTextFromNode(tail).replace(/^\s*[·•]\s*/, "");
      const clone = brandbar.cloneNode(true);
      clone.querySelector("span")?.remove();
      model.meta.brandLead = richTextFromNode(clone);
      count++;
    }
  }
  return count;
}

function importLegacySection(sectionEl, sectionModel) {
  let count = 0;
  if (sectionModel.type === "bullets") {
    const ul = Array.from(sectionEl.children).find((el) => el.tagName === "UL") || sectionEl.querySelector("ul");
    const items = ul ? directListItems(ul) : [];
    if (items.length) { sectionModel.bullets = items; count++; }
  } else if (sectionModel.type === "experience") {
    const jobs = Array.from(sectionEl.querySelectorAll(":scope > .job"));
    sectionModel.jobs.forEach((jobModel, ji) => {
      const jobEl = jobs[ji];
      if (!jobEl) return;
      const heads = Array.from(jobEl.querySelectorAll(":scope > .job-head"));
      const mainHead = heads[0];
      if (mainHead) {
        const company = mainHead.querySelector(".company");
        const dates = mainHead.querySelector(".dates");
        const place = mainHead.querySelector(".jobtitle");
        if (company) { jobModel.company = richTextFromNode(company); count++; }
        if (dates) { jobModel.dates = richTextFromNode(dates); count++; }
        if (place) { jobModel.place = richTextFromNode(place); count++; }
      }
      for (const key of ["subrole", "intro", "meta", "tag"]) {
        const el = jobEl.querySelector(`:scope > .${key}`);
        if (el) { jobModel[key] = richTextFromNode(el); count++; }
      }
      const directUls = Array.from(jobEl.children).filter((el) => el.tagName === "UL");
      if (jobModel.bullets?.length !== undefined && directUls[0] && jobModel.roles.length === 0) {
        jobModel.bullets = directListItems(directUls[0]); count++;
      }
      if (jobModel.roles.length) {
        const roleHeads = heads.slice(1);
        jobModel.roles.forEach((roleModel, ri) => {
          const head = roleHeads[ri];
          if (head) {
            const title = head.querySelector(".jobtitle");
            const dates = head.querySelector(".dates");
            if (title) { roleModel.title = richTextFromNode(title); count++; }
            if (dates) { roleModel.dates = richTextFromNode(dates); count++; }
          }
          const ul = directUls[ri];
          if (ul) { roleModel.bullets = directListItems(ul); count++; }
        });
      }
    });
  } else if (sectionModel.type === "groups") {
    const h3s = Array.from(sectionEl.querySelectorAll(":scope > h3"));
    sectionModel.groups.forEach((group, gi) => {
      const h3 = h3s[gi];
      if (h3) { group.title = richTextFromNode(h3); count++; }
      const candidates = h3 ? siblingsUntil(h3, "H3") : [];
      const intro = candidates.find((el) => el.classList?.contains("intro"));
      const ul = candidates.find((el) => el.tagName === "UL");
      if (intro) { group.intro = richTextFromNode(intro); count++; }
      if (ul) { group.bullets = directListItems(ul); count++; }
    });
  } else if (sectionModel.type === "certs") {
    const cols = Array.from(sectionEl.querySelectorAll(".certcol"));
    sectionModel.columns.forEach((groups, ci) => {
      const groupEls = cols[ci] ? Array.from(cols[ci].querySelectorAll(".certgroup")) : [];
      groups.forEach((group, gi) => {
        const ge = groupEls[gi];
        if (!ge) return;
        const title = ge.querySelector(".t");
        if (title) { group.title = richTextFromNode(title); count++; }
        const lis = Array.from(ge.querySelectorAll(":scope > ul > li"));
        group.items = lis.map((li) => ({
          text: richTextWithoutNestedLists(li),
          sub: Array.from(li.querySelectorAll(":scope > ul.sub > li")).map(richTextFromNode).filter(Boolean)
        })).filter((x) => x.text);
        if (group.items.length) count++;
      });
    });
  } else if (sectionModel.type === "blocks") {
    const blocks = Array.from(sectionEl.querySelectorAll(":scope > .skill"));
    sectionModel.blocks.forEach((block, bi) => {
      const el = blocks[bi]; if (!el) return;
      const title = el.querySelector(":scope > .t");
      const intro = el.querySelector(":scope > .intro");
      const ul = el.querySelector(":scope > ul");
      if (title) { block.title = richTextFromNode(title); count++; }
      if (intro) { block.text = richTextFromNode(intro); count++; }
      if (ul) { block.bullets = directListItems(ul); count++; }
    });
  } else if (sectionModel.type === "projects") {
    // Texto introductorio de la sección (p.ej. la explicación de OpenTrust Group)
    // Puede venir del HTML actual con .projects-intro/.intro o de plantillas anteriores
    // como un párrafo situado entre el H2 y la tabla de proyectos.
    const directChildren = Array.from(sectionEl.children);
    const introEl = directChildren.find((el) =>
      el !== sectionEl.querySelector("h2") &&
      (el.classList?.contains("projects-intro") || el.classList?.contains("intro") || el.tagName === "P") &&
      !el.closest?.(".proj")
    );
    if (introEl) {
      const intro = richTextFromNode(introEl);
      if (intro) { sectionModel.intro = intro; count++; }
    }
    const projects = Array.from(sectionEl.querySelectorAll(".proj"));
    if (projects.length) {
      sectionModel.items = projects.map((el) => ({
        name: richTextFromNode(el.querySelector(".n")),
        url: richTextFromNode(el.querySelector(".u")),
        desc: richTextFromNode(el.querySelector(".d"))
      })).filter((x) => x.name || x.url || x.desc);
      count++;
    }
  }
  return count;
}

function readListNode(node) {
  if (node.tagName === "UL" || node.tagName === "OL") return directListItems(node);
  const children = Array.from(node.children);
  const lineNodes = children.filter((el) => el.matches("p, .claim-line, li"));
  if (lineNodes.length) return lineNodes.map(richTextFromNode).filter(Boolean);
  return textLines(node);
}

function directListItems(ul) {
  return Array.from(ul.children)
    .filter((el) => el.tagName === "LI")
    .map(richTextWithoutNestedLists)
    .filter(Boolean);
}

function richTextWithoutNestedLists(node) {
  if (!node) return "";
  const clone = node.cloneNode(true);
  clone.querySelectorAll("ul,ol").forEach((el) => el.remove());
  return richTextFromNode(clone);
}

function richTextFromNode(node) {
  if (!node) return "";
  const walk = (n) => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent || "";
    if (n.nodeType !== Node.ELEMENT_NODE) return "";
    const inner = Array.from(n.childNodes).map(walk).join("");
    if (n.tagName === "B" || n.tagName === "STRONG") return `**${inner.trim()}**`;
    if (n.tagName === "BR") return "\n";
    return inner;
  };
  return walk(node).replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

function textLines(node) {
  return richTextFromNode(node).split(/\n+/).map((x) => x.trim()).filter(Boolean);
}

function stripBold(value) { return String(value || "").replace(/\*\*/g, "").trim(); }
function deepClone(value) { return JSON.parse(JSON.stringify(value)); }

function setPathValue(root, path, value) {
  const parts = String(path).split(".").filter(Boolean);
  if (!parts.length) return false;
  let target = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (target == null || !(key in target)) return false;
    target = target[key];
  }
  const last = /^\d+$/.test(parts.at(-1)) ? Number(parts.at(-1)) : parts.at(-1);
  if (target == null || !(last in target)) return false;
  target[last] = value;
  return true;
}

function siblingsUntil(start, stopTag) {
  const out = [];
  let el = start.nextElementSibling;
  while (el && el.tagName !== stopTag) { out.push(el); el = el.nextElementSibling; }
  return out;
}

/* --------------------------------------------------------------- Toolbar --- */

function bindToolbar() {
  $("#cv-save")?.addEventListener("click", () => saveDraft());
  $("#cv-reset")?.addEventListener("click", resetModel);
  $("#cv-new-blank")?.addEventListener("click", newBlankDraft);
  $("#cv-import-html")?.addEventListener("click", () => $("#cv-import-html-file")?.click());
  $("#cv-import-html-file")?.addEventListener("change", (event) => importHtmlFile(event.target.files?.[0]));
  $("#cv-export-html")?.addEventListener("click", exportHtml);
  $("#cv-publish")?.addEventListener("click", publish);
  $("#cv-publish-document")?.addEventListener("click", publishToDocument);
  $("#cv-export")?.addEventListener("click", exportPdf);
  $("#cv-refresh-content-versions")?.addEventListener("click", () => loadContentVersions());
  $("#cv-version-select")?.addEventListener("change", (event) => {
    const hasSelection = !!event.target.value;
    const restoreButton = $("#cv-restore-version");
    const deleteButton = $("#cv-delete-version");
    if (restoreButton) restoreButton.disabled = !hasSelection;
    if (deleteButton) deleteButton.disabled = !hasSelection;
  });
  $("#cv-restore-version")?.addEventListener("click", restoreNamedVersion);
  $("#cv-delete-version")?.addEventListener("click", deleteNamedVersion);
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
