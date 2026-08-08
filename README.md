# OpenTrust CV Studio

CV Studio es la aplicación privada de OpenTrust Group para editar, versionar y distribuir un CV profesional mediante enlaces temporales trazables.

## Producción

- Dominio: `https://cvstudio.opentrust.group`
- Worker Cloudflare: `cvstudio`
- D1: `cv-studio-db`
- R2: `opentrust-cv-private`
- Acceso administrativo: Cloudflare Access
- Descargas temporales: `/download/<token>` (deben permanecer accesibles para destinatarios externos según la política Access configurada)
- Correo: Zoho Mail SMTP (`smtppro.zoho.eu:587`, STARTTLS)
- PDF en producción: Cloudflare Browser Run mediante binding `BROWSER`

## Desarrollo local

1. `npm install`
2. Copia `.dev.vars.example` a `.dev.vars` y configura la contraseña/App Password de Zoho.
3. `npm run dev`
4. Abre `http://127.0.0.1:10060/`.

En local:

- D1 se emula localmente.
- R2 se emula localmente.
- La generación PDF usa Edge/Chrome mediante `scripts/pdf-renderer.mjs` en `127.0.0.1:10062`.
- El envío de correo usa Zoho directamente; ya no existe relay SMTP local.
- Los recursos frontend se preparan una vez al arrancar. Si cambias HTML/CSS/JS, reinicia `npm run dev`.

## Build y despliegue

Cloudflare debe ejecutar como Deploy command:

```bash
npm run build && npx wrangler deploy
```

`npm run build` genera `.dev-static`, que está excluido de Git.

## Recursos Cloudflare

`wrangler.jsonc` contiene los bindings no sensibles:

- `DB` → D1 `cv-studio-db`
- `CV_BUCKET` → R2 `opentrust-cv-private`
- `BROWSER` → Browser Run
- `PUBLIC_BASE_URL` → `https://cvstudio.opentrust.group`

Los secretos SMTP no deben almacenarse en Git. En Cloudflare están configurados como Worker secrets:

- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_FROM_NAME`
- `SMTP_REPLY_TO`
- `ALERT_EMAIL_TO`

## Scripts

- `npm run dev` — desarrollo local.
- `npm run build` — prepara assets estáticos para Cloudflare.
- `npm run db:init` — aplica migraciones D1 locales.
- `npm run db:remote` — aplica migraciones D1 remotas (usar conscientemente).
- `npm run check` — validación sintáctica.
- `npm test` — tests.

## Seguridad y repositorio

No versionar:

- `.dev.vars`
- `.dev-static/`
- `.wrangler/`
- `node_modules/`
- PDFs locales
- backups o ZIPs
- credenciales SMTP

El acceso administrativo se delega en Cloudflare Access. La aplicación no implementa una contraseña interna propia.

## Interfaz responsive y plantillas de correo

- En tablet/móvil (y en móviles usando “sitio de escritorio”), la navegación se convierte en un menú lateral desplegable accesible desde el botón superior izquierdo.
- Las tablas mantienen desplazamiento horizontal cuando no caben sin ocultar acciones.
- El editor del CV y las barras de acciones se apilan de forma responsive.
- Las plantillas de correo se almacenan en D1 y se comparten entre dispositivos.
- En **Nuevo envío → Plantilla del mensaje**, usa **Editar plantilla**, modifica nombre, descripción, asunto o mensaje y pulsa **Guardar plantilla**.

La migración `0005_mail_templates.sql` debe aplicarse tanto en local como en producción al actualizar desde una versión anterior.
