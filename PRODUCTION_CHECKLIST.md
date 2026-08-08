# CV Studio · checklist de producción

## Validado

- Dominio `cvstudio.opentrust.group` operativo.
- URL `workers.dev` deshabilitada públicamente.
- Cloudflare Access activo para la zona administrativa.
- D1 remoto operativo y migraciones aplicadas.
- R2 remoto operativo.
- Subida de PDF y vista previa operativas.
- Primario / Backup operativos.
- Publicación desde editor en producción mediante Browser Run.
- Envío SMTP Zoho operativo.
- Enlaces temporales con dominio corporativo.
- Descarga y trazabilidad operativas.
- Estadísticas con actualización automática.
- Revocación y eliminación de enlaces disponibles.

## Validación pendiente manual

- Confirmar una expiración real de enlace: debe pasar a `Caducado` y negar la descarga al reutilizarlo fuera de vigencia.
- Confirmar que la política Cloudflare Access no bloquea `/download/<token>` a destinatarios externos.

## v1.2 · validar tras actualización

- Aplicar `0005_mail_templates.sql` en D1 remoto.
- Abrir CV Studio desde móvil y validar el menú desplegable en orientación vertical y con “sitio de escritorio”.
- Editar una plantilla, guardarla, recargar y confirmar que persiste.
- Abrir la misma plantilla desde otro dispositivo para confirmar persistencia en D1.
