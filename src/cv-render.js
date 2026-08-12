/**
 * Renderizador del CV. Única fuente de la maquetación.
 *
 * El editor nunca produce HTML libre: produce datos. Este módulo decide
 * cómo se ve el documento, tanto en la vista previa como en el PDF.
 *
 * Edición inline en la vista previa: cada campo de texto lleva
 * data-cv-path (dónde vive ese valor dentro del modelo) y data-cv-kind
 * ("text" para una cadena, "list" para un array de líneas/viñetas). El
 * cliente (js/cv-editor.js) usa esos atributos para hacer contenteditable
 * solo esos nodos concretos — nunca la estructura alrededor — y para
 * escribir de vuelta en el modelo cuando el usuario termina de editar.
 * Eso es lo que evita el problema del editor anterior: aquí no hay forma
 * de romper la maquetación, como mucho se edita mal un texto, y en cuanto
 * se sale del campo la vista se regenera limpia desde el modelo.
 *
 * Tipografía: pila web-safe deliberada. El PDF se genera imprimiendo desde
 * el navegador con esta misma maquetación, así que la paginación que ves
 * en la vista previa es la que sale.
 */

const FONT_STACK = `"Segoe UI", Roboto, "Helvetica Neue", Arial, "Liberation Sans", sans-serif`;

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Texto plano con **negrita**. Cualquier otro marcado se escapa. */
const rich = (value = "") =>
  escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

/** Atributos de edición inline. path vacío = campo no editable desde la vista previa. */
const ed = (path, kind = "text") => (path ? ` data-cv-path="${escapeHtml(path)}" data-cv-kind="${kind}"` : "");

const bullets = (items = [], { className = "", path = "" } = {}) =>
  items.length
    ? `<ul${className ? ` class="${className}"` : ""}${ed(path, "list")}>${items.map((i) => `<li>${rich(i)}</li>`).join("")}</ul>`
    : "";

function renderExperience(section, basePath) {
  return section.jobs
    .map((job, ji) => {
      const jp = `${basePath}.jobs.${ji}`;
      const head = `
      <div class="job-head">
        ${job.dates ? `<span class="dates"${ed(`${jp}.dates`)}>${rich(job.dates)}</span>` : ""}
        <span class="company"${ed(`${jp}.company`)}>${rich(job.company)}</span>
        ${job.place ? `<span class="sep">|</span> <span class="jobtitle"${ed(`${jp}.place`)}>${rich(job.place)}</span>` : ""}
        <div class="clear"></div>
      </div>`;
      const roles = job.roles
        .map((role, ki) => {
          const rp = `${jp}.roles.${ki}`;
          return `
        <div class="job-head role-head">
          ${role.dates ? `<span class="dates"${ed(`${rp}.dates`)}>${rich(role.dates)}</span>` : ""}
          <span class="jobtitle"${ed(`${rp}.title`)}>${rich(role.title)}</span>
          <div class="clear"></div>
        </div>
        ${bullets(role.bullets, { path: `${rp}.bullets` })}`;
        })
        .join("");

      return `<div class="job">
        ${head}
        ${job.subrole ? `<div class="subrole"${ed(`${jp}.subrole`)}>${rich(job.subrole)}</div>` : ""}
        ${job.intro ? `<div class="intro"${ed(`${jp}.intro`)}>${rich(job.intro)}</div>` : ""}
        ${job.meta ? `<div class="meta"${ed(`${jp}.meta`)}>${rich(job.meta)}</div>` : ""}
        ${bullets(job.bullets, { path: `${jp}.bullets` })}
        ${job.tag ? `<span class="tag"${ed(`${jp}.tag`)}>${rich(job.tag)}</span>` : ""}
        ${roles}
      </div>`;
    })
    .join("");
}

function renderGroups(section, basePath) {
  return section.groups
    .map((group, gi) => {
      const gp = `${basePath}.groups.${gi}`;
      return `
      <h3${ed(`${gp}.title`)}>${rich(group.title)}</h3>
      ${group.intro ? `<div class="intro"${ed(`${gp}.intro`)}>${rich(group.intro)}</div>` : ""}
      ${bullets(group.bullets, { path: `${gp}.bullets` })}`;
    })
    .join("");
}

function renderCerts(section, basePath) {
  const column = (groups, ci) =>
    groups
      .map((group, gi) => {
        const gp = `${basePath}.columns.${ci}.${gi}`;
        return `
        <div class="certgroup${gi ? " spaced" : ""}">
          <div class="t"${ed(`${gp}.title`)}>${rich(group.title)}</div>
          <ul>${group.items
            .map((item, ii) => {
              const ip = `${gp}.items.${ii}`;
              return `<li><span${ed(`${ip}.text`)}>${rich(item.text)}</span>${bullets(item.sub, { className: "sub", path: `${ip}.sub` })}</li>`;
            })
            .join("")}</ul>
        </div>`;
      })
      .join("");

  return `<table class="lay"><tr>
    <td width="50%"><div class="certcol">${column(section.columns[0] || [], 0)}</div></td>
    <td width="50%"><div class="certcol">${column(section.columns[1] || [], 1)}</div></td>
  </tr></table>`;
}

function renderBlocks(section, basePath) {
  return section.blocks
    .map((block, bi) => {
      const bp = `${basePath}.blocks.${bi}`;
      return `
      <div class="skill">
        <div class="t"${ed(`${bp}.title`)}>${rich(block.title)}</div>
        ${block.text ? `<div class="intro"${ed(`${bp}.text`)}>${rich(block.text)}</div>` : ""}
        ${bullets(block.bullets, { path: `${bp}.bullets` })}
      </div>`;
    })
    .join("");
}

function renderProjects(section, basePath) {
  const intro = section.intro ? `<div class="intro projects-intro"${ed(`${basePath}.intro`)}>${rich(section.intro)}</div>` : "";
  const perRow = section.columns || 4;
  const width = Math.floor(100 / perRow);
  let rows = "";
  for (let i = 0; i < section.items.length; i += perRow) {
    const cells = section.items
      .slice(i, i + perRow)
      .map((item, offset) => {
        const idx = i + offset;
        const ip = `${basePath}.items.${idx}`;
        return `<td width="${width}%"><div class="proj">
          <div class="n"${ed(`${ip}.name`)}>${rich(item.name)}</div>
          ${item.url ? `<div class="u"${ed(`${ip}.url`)}>${rich(item.url)}</div>` : ""}
          ${item.desc ? `<div class="d"${ed(`${ip}.desc`)}>${rich(item.desc)}</div>` : ""}
        </div></td>`;
      })
      .join("");
    const padding = "<td></td>".repeat(perRow - Math.min(perRow, section.items.length - i));
    rows += `<tr>${cells}${padding}</tr>`;
  }
  return `${intro}<table class="lay">${rows}</table>`;
}

function renderSection(section, index) {
  const number = String(index + 1).padStart(2, "0");
  const basePath = `sections.${index}`;
  let body = "";
  if (section.type === "experience") body = renderExperience(section, basePath);
  else if (section.type === "bullets") body = bullets(section.bullets, { path: `${basePath}.bullets` });
  else if (section.type === "groups") body = renderGroups(section, basePath);
  else if (section.type === "certs") body = renderCerts(section, basePath);
  else if (section.type === "blocks") body = renderBlocks(section, basePath);
  else if (section.type === "projects") body = renderProjects(section, basePath);

  return `<section>
    <h2><span class="num">${number}</span><span${ed(`${basePath}.title`)}>${rich(section.title)}</span></h2>
    ${body}
  </section>`;
}

export function renderCvBody(model) {
  const { meta } = model;

  return `
  <div class="head">
    <div class="brandbar">${rich(meta.brandLead)}${meta.brandTail ? ` <span>· ${rich(meta.brandTail)}</span>` : ""}</div>
    <h1${ed("meta.name")}>${rich(meta.name)}</h1>
    ${meta.role ? `<div class="role"${ed("meta.role")}>${rich(meta.role)}</div>` : ""}
    ${
      meta.contact.length
        ? `<div class="contact">${meta.contact
            .map((c, i) => (i === 0 ? `<b>${escapeHtml(c)}</b>` : escapeHtml(c)))
            .join('<span class="sep">|</span>')}</div>`
        : ""
    }
  </div>

  ${
    model.claim.length
      ? `<div class="claim"${ed("claim", "list")}>${model.claim.map((line) => `<div class="claim-line">${rich(line)}</div>`).join("")}</div>`
      : ""
  }
  ${model.summary.length ? `<div class="summary"${ed("summary", "list")}>${model.summary.map((p) => `<p>${rich(p)}</p>`).join("")}</div>` : ""}
  ${
    model.focus.items.length
      ? `<div class="focus">${model.focus.title ? `<div class="t"${ed("focus.title")}>${rich(model.focus.title)}</div>` : ""}${bullets(model.focus.items, { className: "focus-list", path: "focus.items" })}</div>`
      : ""
  }
  ${model.closing ? `<div class="summary"><p${ed("closing")}>${rich(model.closing)}</p></div>` : ""}

  ${model.sections.map(renderSection).join("\n")}

  ${meta.footer ? `<div class="foot"${ed("meta.footer")}>${rich(meta.footer)}</div>` : ""}`;
}

export function cvStyles(mode = "print") {
  // La geometría A4 en pantalla es idéntica en edición y exportación.
  // Al imprimir, el navegador aplica esos mismos márgenes mediante @page.
  // Así el ancho útil (182 mm) y la composición no cambian entre borrador y PDF.
  const screenPage = `
    html { background: #dfe8ec; }
    body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 14mm 16mm; background: #fff; }`;

  const editChrome =
    mode === "preview"
      ? `
    .page-ruler { position: absolute; left: 0; right: 0; border-top: 1px dashed #b7ccd4; pointer-events: none; }
    [data-cv-path] { cursor: text; border-radius: 3px; transition: background-color .1s ease; }
    [data-cv-path]:hover { background: #fef9c3; box-shadow: 0 0 0 2px #fef9c3; }
    [data-cv-path]:focus { outline: none; background: #fef3c7; box-shadow: 0 0 0 2px #f59e0b; }
    ul[data-cv-path]:hover, ul[data-cv-path]:focus,
    div.claim[data-cv-path]:hover, div.claim[data-cv-path]:focus,
    div.summary[data-cv-path]:hover, div.summary[data-cv-path]:focus { background: none; box-shadow: none; }
    ul[data-cv-path] li:hover, div.claim[data-cv-path] .claim-line:hover, div.summary[data-cv-path] p:hover {
      background: #fef9c3; box-shadow: 0 0 0 2px #fef9c3;
    }`
      : "";

  const printChrome = `
    @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
    @media print {
      html { background: #fff; }
      body { width: auto; min-height: 0; margin: 0; padding: 0; background: #fff; }
    }`;

  const pageChrome = `${screenPage}${editChrome}${printChrome}`;

  return `
  * { box-sizing: border-box; }
  body { font-family: ${FONT_STACK}; font-size: 9.1pt; line-height: 1.34; color: #1f2937; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${pageChrome}

  .brandbar { font-size: 7.2pt; letter-spacing: .16em; text-transform: uppercase; color: #0f766e; font-weight: 700; margin-bottom: 5px; }
  .brandbar span { color: #94a3b8; font-weight: 600; }
  .head { border-bottom: 2.2pt solid #0f766e; padding-bottom: 9px; margin-bottom: 10px; }
  h1 { font-size: 23pt; line-height: 1.05; margin: 0 0 2px 0; font-weight: 700; letter-spacing: -.015em; color: #0f172a; }
  .role { font-size: 11pt; color: #0f766e; font-weight: 700; margin-bottom: 5px; }
  .contact { font-size: 8.4pt; color: #475569; }
  .contact b { color: #0f172a; font-weight: 600; }
  .sep { color: #cbd5e1; padding: 0 5px; }

  .claim { border-left: 2.5pt solid #0f766e; background: #f0fdfa; padding: 5px 9px; margin-bottom: 9px; font-size: 8.6pt; color: #0f172a; font-weight: 600; }
  .claim-line { display: block; }
  .summary p { font-size: 8.9pt; color: #334155; text-align: justify; margin: 0 0 4px 0; }
  .focus { margin: 4px 0; }
  .focus .t { font-size: 8.6pt; font-weight: 700; color: #0f172a; }
  ul.focus-list { columns: 2; column-gap: 16px; }
  ul.focus-list li { break-inside: avoid; }

  h2 { font-size: 9.4pt; text-transform: uppercase; letter-spacing: .12em; color: #0f172a; font-weight: 700; margin: 0 0 8px 0; padding-bottom: 3px; border-bottom: .8pt solid #e2e8f0; break-after: avoid; page-break-after: avoid; }
  h2 .num { color: #0f766e; margin-right: 7px; font-weight: 700; }
  section { margin-bottom: 11px; }
  h3 { font-size: 8.8pt; font-weight: 700; color: #0f172a; margin: 7px 0 2px 0; break-after: avoid; page-break-after: avoid; }

  .job { margin-bottom: 10px; }
  .job-head { margin-bottom: 2px; break-after: avoid; page-break-after: avoid; }
  .role-head { margin-top: 6px; }
  .company { font-size: 10.2pt; font-weight: 700; color: #0f172a; }
  .dates { float: right; font-size: 8pt; color: #0f766e; font-weight: 700; white-space: nowrap; }
  .jobtitle { font-size: 9.2pt; font-weight: 700; color: #334155; }
  .meta { font-size: 7.9pt; color: #64748b; font-style: italic; margin-bottom: 3px; }
  .intro { font-size: 8.6pt; color: #334155; text-align: justify; margin-bottom: 3px; }
  .tag { display: inline-block; font-size: 7.2pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #0f766e; background: #f0fdfa; border: .6pt solid #99f6e4; border-radius: 8px; padding: 1px 7px; margin-top: 3px; }
  .subrole { font-size: 8.7pt; font-weight: 700; color: #0f766e; margin: 6px 0 1px 0; }

  ul { margin: 2px 0 0 0; padding-left: 13px; }
  li { margin-bottom: 1.2px; }
  li::marker { color: #0f766e; }
  ul.sub { margin-top: 1px; padding-left: 13px; }
  ul.sub li { font-size: 8pt; color: #475569; margin-bottom: 0; }
  ul.sub li::marker { color: #cbd5e1; }
  b { color: #0f172a; }

  table.lay { width: 100%; border-collapse: separate; border-spacing: 0; }
  table.lay td { vertical-align: top; padding: 0 10px 6px 0; }

  .certcol .t { font-size: 7.6pt; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; color: #0f766e; margin-bottom: 2px; }
  .certgroup.spaced { margin-top: 7px; }
  .certcol ul { padding-left: 12px; margin-top: 1px; }
  .certcol li { font-size: 8.3pt; color: #334155; }

  .proj .n { font-size: 8.7pt; font-weight: 700; color: #0f172a; }
  .proj .u { font-size: 7.4pt; color: #0f766e; font-weight: 600; word-wrap: break-word; }
  .proj .d { font-size: 7.9pt; color: #64748b; line-height: 1.26; }

  .skill .t { font-size: 8.6pt; font-weight: 700; color: #0f172a; margin-top: 5px; }
  .foot { margin-top: 8px; border-top: 2.2pt solid #0f766e; padding-top: 5px; font-size: 7.6pt; color: #64748b; text-align: center; letter-spacing: .05em; }
  .foot b { color: #0f766e; letter-spacing: .14em; }
  .clear { clear: both; }`;
}

export function renderCvDocument(model, mode = "print") {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(model.meta.name)} · Vida profesional</title>
<style>${cvStyles(mode)}</style>
</head>
<body>
${renderCvBody(model)}
</body>
</html>`;
}
