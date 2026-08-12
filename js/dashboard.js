import { initCvEditor } from "./cv-editor.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const MAIL_TEMPLATES = {
  selection: { name: "Proceso de selección", description: "Directa, profesional y orientada a recruiters.", subject: "Miguel Ángel Carriazo · Perfil profesional y experiencia", message: `Gracias por tu interés en mi perfil.\n\nA través del enlace incluido en este mensaje podrás consultar mi vida profesional completa, con información actualizada sobre mi experiencia en arquitectura de soluciones, infraestructura, ciberseguridad, gobierno tecnológico, continuidad, cloud y liderazgo de equipos y servicios críticos.\n\nEl acceso es personal y temporal. Quedo a tu disposición para ampliar cualquier aspecto de mi trayectoria o comentar el posible encaje con la posición.` },
  executive: { name: "Perfil ejecutivo", description: "Más sénior y centrada en gobierno y liderazgo.", subject: "Miguel Ángel Carriazo · Trayectoria en Arquitectura, Infraestructura y Ciberseguridad", message: `Te facilito acceso temporal a mi vida profesional completa, desarrollada durante más de 25 años en entornos tecnológicos críticos, regulados, híbridos y cloud.\n\nEl documento recoge mi experiencia en gobierno de arquitectura, infraestructura, ciberseguridad, continuidad de negocio, gestión de riesgos, cumplimiento, operaciones IT, liderazgo y transformación tecnológica.\n\nTambién incluye los proyectos y productos profesionales que desarrollo dentro del ecosistema OpenTrust Group. Estaré encantado de ampliar cualquier información que resulte relevante.` }
};

const state = { links: [], filter: "ALL", view: "new-send", cvVersions: [], selectedLinks: new Set(), selectedDownloadEvents: new Set(), mailTemplates: structuredClone(MAIL_TEMPLATES), editingTemplate: false };

const VIEW_COPY = {
  "new-send": ["Nuevo envío", "Genera un acceso temporal y envíalo con una presentación profesional."],
  links: ["Enlaces", "Consulta, controla y revoca los accesos temporales generados."],
  statistics: ["Estadísticas", "Consulta los envíos realizados y las descargas registradas."],
  document: ["Documento", "Gestiona el PDF publicado de tu vida profesional."],
  "cv-editor": ["Editor del CV", "Edita el contenido por campos y publica la versión que se envía."]
};

init();
async function init(){
  bind();
  await loadMailTemplates();
  applyTemplate("selection");
  navigate(location.hash.replace("#", "") || "new-send", false);
  await Promise.all([loadCv(), loadCvVersions(), loadLinks(), loadStatistics()]);
  initCvEditor();
}

function bind(){
  $$('[data-view]').forEach((el)=>el.addEventListener('click',(event)=>{event.preventDefault();navigate(el.dataset.view);closeMobileMenu();}));
  window.addEventListener('hashchange',()=>navigate(location.hash.replace('#','') || 'new-send',false));
  $$('input[name="mail-template"]').forEach(el=>el.addEventListener('change',()=>{if(el.checked){if(state.editingTemplate)cancelTemplateEdit();applyTemplate(el.value);}}));
  $('#edit-mail-template')?.addEventListener('click',startTemplateEdit);
  $('#save-mail-template')?.addEventListener('click',saveTemplateEdit);
  $('#cancel-mail-template')?.addEventListener('click',cancelTemplateEdit);
  $('#mobile-menu-toggle')?.addEventListener('click',toggleMobileMenu);
  $('#mobile-menu-backdrop')?.addEventListener('click',closeMobileMenu);
  $$('input[name="expiry"]').forEach(el=>el.addEventListener('change',()=>$('#custom-date-wrap').classList.toggle('hidden',el.value!=="custom" || !el.checked)));
  $('#link-form').addEventListener('submit',sendCv);
  $('#preview-mail').addEventListener('click',previewMail);
  $('#close-preview').addEventListener('click',()=>$('#mail-preview').close());
  $('#close-cv-preview')?.addEventListener('click',()=>closeCvPreview());
  $('#cv-form').addEventListener('submit',uploadCv);
  $('#copy-generated').addEventListener('click',()=>copyText($('#generated-url').value));
  $('#refresh').addEventListener('click',loadLinks);
  $('#select-all-links')?.addEventListener('change',toggleSelectAllLinks);
  $('#delete-selected-links')?.addEventListener('click',deleteSelectedLinks);
  $('#revoke-all-active')?.addEventListener('click',revokeAllActive);
  $('#purge-old-links')?.addEventListener('click',purgeOldLinks);
  $('#refresh-statistics').addEventListener('click',loadStatistics);
  $('#refresh-statistics-downloads')?.addEventListener('click',loadStatistics);
  $('#select-all-download-events')?.addEventListener('change',toggleSelectAllDownloadEvents);
  $('#delete-selected-download-events')?.addEventListener('click',deleteSelectedDownloadEvents);
  $('#delete-all-download-events')?.addEventListener('click',deleteAllDownloadEvents);
  $('#refresh-versions')?.addEventListener('click',loadCvVersions);
  $$('.filters button').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filter; $$('.filters button').forEach(x=>x.classList.toggle('active',x===b)); renderLinks();}));
  $('#cv-file').addEventListener('change',e=>{if(e.target.files[0]) $('#drop-zone strong').textContent=e.target.files[0].name;});
  document.addEventListener('cv-document-published',()=>{loadCv();loadCvVersions();});
}

function navigate(view, updateHash=true){
  if(!VIEW_COPY[view]) view='new-send';
  state.view=view;
  $$('[data-view-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.viewPanel===view));
  $$('[data-view]').forEach(link=>link.classList.toggle('active',link.dataset.view===view));
  $('#view-title').textContent=VIEW_COPY[view][0];
  $('#view-subtitle').textContent=VIEW_COPY[view][1];
  if(updateHash && location.hash!==`#${view}`) history.pushState(null,'',`#${view}`);

  // Los accesos al CV pueden producirse desde otro navegador o dispositivo.
  // Refrescamos los módulos dinámicos al entrar para no mostrar datos obsoletos.
  if(view==='statistics') loadStatistics();
  if(view==='links') loadLinks();
  if(view==='document') { loadCv(); loadCvVersions(); }

  window.scrollTo({top:0,behavior:'smooth'});
}

async function loadMailTemplates(){
  try{
    const data=await api('/api/mail-templates');
    for(const item of data.templates||[]){
      state.mailTemplates[item.template_key]={name:item.name,description:item.description,subject:item.subject,message:item.message};
    }
    renderTemplateCards();
  }catch(e){
    console.warn('No se pudieron cargar plantillas desde D1; se usan las predeterminadas.',e);
    renderTemplateCards();
  }
}
function selectedTemplateKey(){return $('input[name="mail-template"]:checked')?.value||'selection';}
function renderTemplateCards(){
  Object.entries(state.mailTemplates).forEach(([key,t])=>{
    const name=$(`[data-template-name="${key}"]`);const desc=$(`[data-template-description="${key}"]`);
    if(name)name.textContent=t.name;if(desc)desc.textContent=t.description;
  });
}
function applyTemplate(templateKey){
  const template=state.mailTemplates[templateKey] || state.mailTemplates.selection;
  $('#mail-subject').value=template.subject;
  $('#mail-message').value=template.message;
}
function setTemplateEditing(editing){
  state.editingTemplate=editing;
  $('#mail-subject').readOnly=!editing;$('#mail-message').readOnly=!editing;
  $('#template-edit-grid').classList.toggle('hidden',!editing);
  $('#edit-mail-template').classList.toggle('hidden',editing);
  $('#save-mail-template').classList.toggle('hidden',!editing);
  $('#cancel-mail-template').classList.toggle('hidden',!editing);
  $$('input[name="mail-template"]').forEach(x=>x.disabled=editing);
}
function startTemplateEdit(){
  const key=selectedTemplateKey();const t=state.mailTemplates[key];
  $('#template-name').value=t.name;$('#template-description').value=t.description;setTemplateEditing(true);$('#mail-subject').focus();
}
function cancelTemplateEdit(){setTemplateEditing(false);applyTemplate(selectedTemplateKey());}
async function saveTemplateEdit(){
  const key=selectedTemplateKey();const button=$('#save-mail-template');button.disabled=true;button.textContent='Guardando…';
  try{
    const body={name:$('#template-name').value.trim(),description:$('#template-description').value.trim(),subject:$('#mail-subject').value.trim(),message:$('#mail-message').value.trim()};
    const data=await api(`/api/mail-templates/${key}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    state.mailTemplates[key]={name:data.template.name,description:data.template.description,subject:data.template.subject,message:data.template.message};
    renderTemplateCards();setTemplateEditing(false);applyTemplate(key);toast('Plantilla guardada');
  }catch(e){toast(e.message);}finally{button.disabled=false;button.textContent='Guardar plantilla';}
}
function toggleMobileMenu(){document.body.classList.contains('menu-open')?closeMobileMenu():openMobileMenu();}
function openMobileMenu(){document.body.classList.add('menu-open');$('#mobile-menu-toggle')?.setAttribute('aria-expanded','true');const b=$('#mobile-menu-backdrop');if(b)b.hidden=false;}
function closeMobileMenu(){document.body.classList.remove('menu-open');$('#mobile-menu-toggle')?.setAttribute('aria-expanded','false');const b=$('#mobile-menu-backdrop');if(b)b.hidden=true;}

async function loadCv(){
  try{const data=await api('/api/cv');
    if(!data.exists){$('#cv-status').textContent='No disponible'; return;}
    $('#cv-status').textContent='Disponible'; $('#cv-status').className='status ok';
    $('#cv-name').textContent=data.fileName; $('#cv-version').textContent=data.version || 'Versión local';
    $('#cv-meta').textContent=[data.updatedAt?formatDate(data.updatedAt):'CV inicial',formatBytes(data.fileSize)].join(' · ');
    $('#download-cv').href='/api/cv/download'; $('#download-cv').classList.remove('disabled');
  }catch(e){toast(e.message);}
}

async function sendCv(e){
  e.preventDefault();
  const button=e.submitter;
  button.disabled=true;
  button.textContent='Generando enlace y enviando…';

  try{
    const body=mailPayload();
    const result=await api('/api/send-cv',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    });
    showGenerated(result);
    await Promise.all([loadLinks(),loadStatistics()]);
    toast('Correo enviado correctamente');
  }catch(err){
    toast(err.message || 'No se pudo enviar el correo.');
    console.error('Error de envío:',err);
    await loadLinks().catch(()=>{});
  }finally{
    button.disabled=false;
    button.textContent='Generar enlace y enviar';
  }
}

async function previewMail(){
  const button=$('#preview-mail');button.disabled=true;button.textContent='Preparando…';
  try{const data=await api('/api/mail/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(mailPayload(false))});
    $('#mail-preview-frame').srcdoc=data.html;$('#mail-preview').showModal();
  }catch(err){toast(err.message);}finally{button.disabled=false;button.textContent='Vista previa del correo';}
}

function mailPayload(requireEmail=true){
  const selected=$('input[name="expiry"]:checked').value;
  const body={to:$('#recipient-email').value.trim(),recipientName:$('#recipient-name').value.trim(),subject:$('#mail-subject').value.trim(),message:$('#mail-message').value.trim()};
  if(requireEmail&&!body.to)throw new Error('Introduce la dirección de envío.');
  const maxDownloads=Number($('#max-downloads').value);
  if(!Number.isInteger(maxDownloads)||maxDownloads<1||maxDownloads>20)throw new Error('El número de descargas debe estar entre 1 y 20.');
  body.maxDownloads=maxDownloads;
  if(selected==='custom'){if(!$('#custom-date').value)throw new Error('Selecciona fecha y hora.');body.expiresAt=new Date($('#custom-date').value).toISOString();}else body.minutes=Number(selected);
  return body;
}

function showGenerated(data){
  const maxDownloads=Math.max(1,Number(data.maxDownloads||1));
  $('#generated-url').value=data.url;$('#open-generated').href=data.url;$('#generated-expiry').textContent=`Válido hasta ${formatDate(data.expiresAt)} · ${maxDownloads} ${maxDownloads===1?'descarga real disponible':'descargas reales disponibles'}; los accesos automáticos no las consumen`;$('#generated').classList.remove('hidden');
}

async function uploadCv(e){
  e.preventDefault(); const button=e.submitter; button.disabled=true; button.textContent='Subiendo…';
  const activate=$('#cv-activate-on-upload').checked;
  try{
    const fd=new FormData(); fd.append('file',$('#cv-file').files[0]); fd.append('version',$('#cv-version-input').value); fd.append('type','full'); fd.append('activate',activate?'true':'false');
    await api('/api/cv',{method:'POST',body:fd});
    toast(activate?'Versión subida y activada':'Versión guardada en el historial');
    e.target.reset(); $('#drop-zone strong').textContent='Seleccionar PDF'; $('#cv-activate-on-upload').checked=true;
    await Promise.all([loadCv(),loadCvVersions()]);
  }
  catch(err){toast(err.message);} finally{button.disabled=false;button.textContent='Guardar en el historial';}
}

async function loadCvVersions(){
  try{const data=await api('/api/cv/versions');state.cvVersions=data.versions||[];renderCvVersions();}
  catch(e){$('#cv-versions-body').innerHTML=`<tr><td colspan="6" class="empty">${escapeHtml(e.message)}</td></tr>`;}
}

function renderCvVersions(){
  const rows=state.cvVersions||[];
  $('#cv-versions-body').innerHTML=rows.length?rows.map(v=>`<tr class="${v.is_active?'primary-version-row':''}">
    <td><strong>${escapeHtml(v.file_name)}</strong>${v.is_active?'<small class="primary-note">PDF usado en los nuevos envíos</small>':''}</td>
    <td>${escapeHtml(v.version||'—')}</td>
    <td>${formatBytes(v.file_size)}</td>
    <td>${formatDate(v.created_at)}</td>
    <td>${v.is_active?'<span class="pill ACTIVE">Primario</span>':'<span class="pill backup">Backup</span>'}</td>
    <td class="row-actions">
      <button class="icon-btn" type="button" data-preview-version="${v.id}" data-preview-name="${escapeHtml(v.version||v.file_name)}">Vista previa</button>
      <a class="icon-btn" href="/api/cv/versions/${v.id}/download" title="Descargar PDF">Descargar</a>
      ${v.is_active?'<span class="primary-current" title="Este es el documento utilizado en los nuevos envíos">Primario actual</span>':`<button class="secondary promote-primary" type="button" data-activate="${v.id}">Poner como primario</button>`}
      ${v.is_active?'<button class="danger" type="button" disabled title="Pon otro PDF como primario antes de eliminar este">Eliminar</button>':`<button class="danger" type="button" data-delete-version="${v.id}">Eliminar</button>`}
    </td>
  </tr>`).join(''):'<tr><td colspan="6" class="empty">Todavía no has subido ningún PDF.</td></tr>';
  $$('[data-preview-version]').forEach(b=>b.addEventListener('click',()=>previewCvVersion(Number(b.dataset.previewVersion),b.dataset.previewName)));
  $$('[data-activate]').forEach(b=>b.addEventListener('click',()=>activateVersion(Number(b.dataset.activate))));
  $$('[data-delete-version]').forEach(b=>b.addEventListener('click',(event)=>{
    event.preventDefault();
    event.stopPropagation();
    deleteVersion(Number(b.dataset.deleteVersion),b);
  }));
}

function previewCvVersion(id,name){
  const dialog=$('#cv-preview');
  const frame=$('#cv-preview-frame');
  if(!dialog||!frame)return;
  $('#cv-preview-title').textContent=name?`Vista previa · ${name}`:'Vista previa del documento';
  frame.src=`/api/cv/versions/${id}/preview`;
  dialog.showModal();
}

function closeCvPreview(){
  const dialog=$('#cv-preview');
  const frame=$('#cv-preview-frame');
  if(frame)frame.src='about:blank';
  dialog?.close();
}

async function activateVersion(id){
  if(!confirm('Esta versión pasará a ser el documento PRIMARIO y será la que reciban los nuevos envíos. El primario actual quedará como BACKUP y conservará su histórico. ¿Continuar?'))return;
  try{await api(`/api/cv/versions/${id}/activate`,{method:'POST'});toast('Documento primario actualizado');await Promise.all([loadCv(),loadCvVersions()]);}
  catch(e){toast(e.message);}
}

async function deleteVersion(id,button){
  if(!confirm('Se eliminará este PDF del almacenamiento. El histórico de envíos se conserva. ¿Continuar?'))return;

  const originalText=button?.textContent||'Eliminar';
  if(button){button.disabled=true;button.textContent='Eliminando…';}

  try{
    closeCvPreview();
    await api(`/api/cv/versions/${id}/delete`,{method:'POST'});
    toast('Documento eliminado');
    await Promise.all([loadCv(),loadCvVersions()]);
    if(state.view!=='document')navigate('document');
  }catch(e){
    toast(e.message||'No se pudo eliminar el documento.');
  }finally{
    if(button&&document.body.contains(button)){button.disabled=false;button.textContent=originalText;}
  }
}

async function loadStatistics(){
  try{
    const data=await api('/api/statistics');
    state.statistics=data;
    renderStatistics();
  }catch(e){toast(e.message);}
}
function renderStatistics(){
  const summary=state.statistics.summary||{};
  $('#stat-total-sent').textContent=Number(summary.total_sent||0);
  $('#stat-total-downloads').textContent=Number(summary.total_downloads||0);
  $('#stat-active-statistics').textContent=Number(summary.active_links||0);
  $('#stat-total-links').textContent=Number(summary.total_links||0);

  const sends=state.statistics.sends||[];
  $('#statistics-sends-body').innerHTML=sends.length?sends.map(x=>`<tr>
    <td><strong>${escapeHtml(x.recipient_name||'Sin nombre')}</strong><br><small>${escapeHtml(x.recipient_email||'—')}</small></td>
    <td>${escapeHtml(x.cv_version||'—')}<br><small>${escapeHtml(x.cv_file_name||'')}</small></td>
    <td>${x.sent_at?formatDate(x.sent_at):'<span class="muted-text">No enviado</span>'}</td>
    <td>${formatDate(x.expires_at)}</td>
    <td>${Number(x.download_count||0)}</td>
    <td><span class="pill ${x.status}">${label(x.status)}</span></td>
  </tr>`).join(''):'<tr><td colspan="6" class="empty">Todavía no hay envíos registrados.</td></tr>';

  const downloads=state.statistics.downloads||[];
  const existingDownloadIds=new Set(downloads.map(x=>Number(x.id)));
  state.selectedDownloadEvents=new Set([...state.selectedDownloadEvents].filter(id=>existingDownloadIds.has(id)));
  $('#statistics-downloads-body').innerHTML=downloads.length?downloads.map(x=>`<tr>
    <td class="check-column"><input class="link-checkbox" type="checkbox" data-select-download-event="${x.id}" ${state.selectedDownloadEvents.has(Number(x.id))?'checked':''} aria-label="Seleccionar acceso ${x.id}"></td>
    <td>${formatDate(x.downloaded_at)}</td>
    <td><strong>${escapeHtml(x.ip_address||'No disponible')}</strong><br><small>${escapeHtml([x.city,x.country].filter(Boolean).join(', ')||'Sin geolocalización')}${x.as_organization?` · ${escapeHtml(x.as_organization)}`:''}${x.asn?` (AS${Number(x.asn)})`:''}</small></td>
    <td>${classificationBadge(x)}</td>
    <td>${escapeHtml(x.recipient_name||'Sin nombre')}<br><small>${escapeHtml(x.recipient_email||'—')}</small></td>
    <td>${escapeHtml(x.cv_version||'—')}<br><small>${escapeHtml(x.cv_file_name||'')}</small></td>
    <td class="user-agent">${escapeHtml(x.user_agent||'No disponible')}</td>
  </tr>`).join(''):'<tr><td colspan="7" class="empty">Todavía no hay accesos registrados.</td></tr>';
  $$('[data-select-download-event]').forEach(cb=>cb.addEventListener('change',()=>{const id=Number(cb.dataset.selectDownloadEvent);cb.checked?state.selectedDownloadEvents.add(id):state.selectedDownloadEvents.delete(id);updateDownloadEventControls();}));
  updateDownloadEventControls();
}

function classificationBadge(x){
  if(x.classification==='POSSIBLE_AUTOMATION') return `<span class="pill EXPIRED" title="${escapeHtml(x.classification_reason||'Clasificación orientativa')}">Posible automático</span>`;
  if(x.classification==='HUMAN_LIKELY') return '<span class="pill ACTIVE">Humano probable</span>';
  return '<span class="pill backup">No determinado</span>';
}
function updateDownloadEventControls(){
  const rows=state.statistics?.downloads||[];
  const ids=rows.map(x=>Number(x.id));
  const selectedVisible=ids.filter(id=>state.selectedDownloadEvents.has(id)).length;
  const all=$('#select-all-download-events');
  if(all){all.checked=ids.length>0&&selectedVisible===ids.length;all.indeterminate=selectedVisible>0&&selectedVisible<ids.length;}
  const button=$('#delete-selected-download-events');
  if(button){button.disabled=state.selectedDownloadEvents.size===0;button.textContent=state.selectedDownloadEvents.size?`Eliminar seleccionados (${state.selectedDownloadEvents.size})`:'Eliminar seleccionados';}
}
function toggleSelectAllDownloadEvents(event){
  const ids=(state.statistics?.downloads||[]).map(x=>Number(x.id));
  ids.forEach(id=>event.target.checked?state.selectedDownloadEvents.add(id):state.selectedDownloadEvents.delete(id));
  renderStatistics();
}
async function deleteSelectedDownloadEvents(){
  const ids=[...state.selectedDownloadEvents];
  if(!ids.length)return;
  if(!confirm(`¿Eliminar definitivamente ${ids.length} registro(s) de acceso seleccionados? Esto no revoca los enlaces.`))return;
  try{const result=await api('/api/statistics/downloads/bulk-delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids})});state.selectedDownloadEvents.clear();toast(`${result.deleted||0} registro(s) eliminados`);await loadStatistics();}catch(e){toast(e.message);}
}
async function deleteAllDownloadEvents(){
  const count=Number(state.statistics?.downloads?.length||0);
  if(!confirm('¿Eliminar TODAS las estadísticas de acceso? Se borrará la trazabilidad técnica de descargas, pero los enlaces y envíos seguirán existiendo.'))return;
  try{const result=await api('/api/statistics/downloads',{method:'DELETE'});state.selectedDownloadEvents.clear();toast(`${result.deleted||0} registro(s) eliminados`);await loadStatistics();}catch(e){toast(e.message);}
}

async function loadLinks(){try{const data=await api('/api/links');state.links=data.links;const existing=new Set(state.links.map(x=>Number(x.id)));state.selectedLinks=new Set([...state.selectedLinks].filter(id=>existing.has(id)));renderStats();renderLinks();}catch(e){toast(e.message);}}
function renderStats(){$('#stat-active').textContent=state.links.filter(x=>x.status==='ACTIVE').length;$('#stat-used').textContent=state.links.reduce((n,x)=>n+Number(x.download_count||0),0);$('#stat-expired').textContent=state.links.filter(x=>x.status==='EXPIRED').length;$('#stat-revoked').textContent=state.links.filter(x=>x.status==='REVOKED').length;}
function visibleLinks(){return state.links.filter(x=>state.filter==='ALL'||x.status===state.filter);}
function renderLinks(){
  const rows=visibleLinks();
  $('#links-body').innerHTML=rows.length?rows.map(x=>`<tr>
    <td class="check-column"><input class="link-checkbox" type="checkbox" data-select-link="${x.id}" ${state.selectedLinks.has(Number(x.id))?'checked':''} aria-label="Seleccionar enlace ${escapeHtml(x.token_hint)}"></td>
    <td><strong>${escapeHtml(x.token_hint)}</strong><br><small>${escapeHtml(x.cv_version)}</small></td>
    <td>${formatDate(x.created_at)}</td><td>${formatDate(x.expires_at)}</td><td>${x.status==='USED'?0:Math.max(0,Number(x.max_downloads||1)-Number(x.download_count||0))}</td>
    <td><span class="pill ${x.status}">${label(x.status)}</span></td>
    <td class="link-actions">${x.status==='ACTIVE'?`<button class="secondary compact" data-revoke="${x.id}">Revocar</button>`:''}<button class="danger compact" data-delete-link="${x.id}">Eliminar</button></td>
  </tr>`).join(''):'<tr><td colspan="7" class="empty">No hay enlaces en este estado.</td></tr>';
  $$('[data-revoke]').forEach(b=>b.addEventListener('click',()=>revoke(Number(b.dataset.revoke))));
  $$('[data-delete-link]').forEach(b=>b.addEventListener('click',()=>deleteLink(Number(b.dataset.deleteLink))));
  $$('[data-select-link]').forEach(cb=>cb.addEventListener('change',()=>{const id=Number(cb.dataset.selectLink);cb.checked?state.selectedLinks.add(id):state.selectedLinks.delete(id);updateBulkControls();}));
  updateBulkControls();
}
function updateBulkControls(){
  const rows=visibleLinks();
  const visibleIds=rows.map(x=>Number(x.id));
  const selectedVisible=visibleIds.filter(id=>state.selectedLinks.has(id)).length;
  const all=$('#select-all-links');
  if(all){all.checked=visibleIds.length>0&&selectedVisible===visibleIds.length;all.indeterminate=selectedVisible>0&&selectedVisible<visibleIds.length;}
  const button=$('#delete-selected-links');
  if(button){button.disabled=state.selectedLinks.size===0;button.textContent=state.selectedLinks.size?`Eliminar seleccionados (${state.selectedLinks.size})`:'Eliminar seleccionados';}
}
function toggleSelectAllLinks(event){
  const ids=visibleLinks().map(x=>Number(x.id));
  ids.forEach(id=>event.target.checked?state.selectedLinks.add(id):state.selectedLinks.delete(id));
  renderLinks();
}
async function revoke(id){if(!confirm('¿Invalidar este enlace inmediatamente?'))return;try{await api(`/api/links/${id}/revoke`,{method:'POST'});toast('Enlace revocado');await loadLinks();await loadStatistics();}catch(e){toast(e.message);}}
async function deleteLink(id){
  const link=state.links.find(x=>Number(x.id)===id);
  const warning=link?.status==='ACTIVE'?' El enlace está ACTIVO y dejará de funcionar inmediatamente.':'';
  if(!confirm(`¿Eliminar definitivamente este enlace y su historial de descargas?${warning}`))return;
  try{await api(`/api/links/${id}`,{method:'DELETE'});state.selectedLinks.delete(id);toast('Enlace eliminado');await Promise.all([loadLinks(),loadStatistics()]);}catch(e){toast(e.message);}
}
async function deleteSelectedLinks(){
  const ids=[...state.selectedLinks];
  if(!ids.length)return;
  const activeCount=state.links.filter(x=>ids.includes(Number(x.id))&&x.status==='ACTIVE').length;
  const warning=activeCount?`\n\nAtención: ${activeCount} enlace(s) están activos y dejarán de funcionar.`:'';
  if(!confirm(`¿Eliminar definitivamente ${ids.length} enlace(s) seleccionados y sus historiales de descarga?${warning}`))return;
  try{const result=await api('/api/links/bulk-delete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids})});state.selectedLinks.clear();toast(`${result.deleted||ids.length} enlace(s) eliminados`);await Promise.all([loadLinks(),loadStatistics()]);}catch(e){toast(e.message);}
}
async function revokeAllActive(){
  const activeCount=state.links.filter(x=>x.status==='ACTIVE').length;
  if(!activeCount){toast('No hay enlaces activos para revocar');return;}
  if(!confirm(`¿Revocar los ${activeCount} enlace(s) activos? Dejarán de funcionar inmediatamente, pero se conservarán en el histórico.`))return;
  try{const result=await api('/api/links/revoke-all',{method:'POST'});toast(`${result.revoked||0} enlace(s) revocados`);await Promise.all([loadLinks(),loadStatistics()]);}catch(e){toast(e.message);}
}
async function purgeOldLinks(){
  const days=Number($('#link-retention-days')?.value||30);
  if(!confirm(`¿Eliminar definitivamente los enlaces FINALIZADOS creados hace más de ${days} días? Los enlaces activos se conservarán. También se borrará su historial de descargas.`))return;
  try{const result=await api('/api/links/purge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({days})});state.selectedLinks.clear();if(Number(result.deleted||0)===0){toast(`No hay enlaces finalizados creados hace más de ${days} días`);}else{toast(`${result.deleted} enlace(s) eliminados`);}await Promise.all([loadLinks(),loadStatistics()]);}catch(e){toast(e.message);}
}
async function api(url,opts={}){const r=await fetch(url,{credentials:'same-origin',...opts});const d=await readResponse(r);if(!r.ok)throw new Error(d.error||`Error HTTP ${r.status}`);return d;}
async function readResponse(response){
  const text=await response.text();
  if(!text)return {};
  try{return JSON.parse(text);}
  catch{
    const contentType=(response.headers.get('content-type')||'').toLowerCase();
    if(contentType.includes('text/html')||/^\s*</.test(text)){
      throw new Error(`Respuesta inesperada del servidor (HTTP ${response.status}). Recarga CV Studio e inténtalo de nuevo.`);
    }
    throw new Error(text.trim()||`Respuesta no válida (HTTP ${response.status})`);
  }
}
async function copyText(text,notify=true){await navigator.clipboard.writeText(text);if(notify)toast('Copiado al portapapeles');}
function formatDate(v){return new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}
function formatBytes(v=0){if(!v)return '—';return v>1048576?`${(v/1048576).toFixed(1)} MB`:`${Math.round(v/1024)} KB`;}
function label(s){return({ACTIVE:'Activo',USED:'Utilizado',EXPIRED:'Caducado',REVOKED:'Revocado'})[s]||s;}
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
let toastTimer;function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}

