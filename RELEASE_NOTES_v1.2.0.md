# CV Studio v1.2.0

## Cambios principales

- Navegación responsive real con menú lateral desplegable para móvil/tablet y móviles en modo “sitio de escritorio”.
- Ajustes responsive de estadísticas, filtros, toolbars, tablas, envío y editor del CV.
- Plantillas de mensaje editables desde Nuevo envío.
- Botones Editar plantilla / Guardar plantilla / Cancelar.
- Persistencia de nombre, descripción, asunto y mensaje en Cloudflare D1.
- Nueva migración `0005_mail_templates.sql` con las dos plantillas actuales como valores iniciales.
- Se mantienen todas las funciones validadas previamente: D1, R2, Browser Run, Zoho SMTP, enlaces, estadísticas, primario/backup y eliminación segura de documentos.

## Actualización desde v1.1

Local:

```bash
npm install
npm run db:init
npm run check
npm test
npm run dev
```

Producción, después de desplegar el código:

```bash
npx wrangler d1 migrations apply cv-studio-db --remote --name cvstudio
```

Si tu versión de Wrangler no admite `--name` en D1 migrations, usa:

```bash
npm run db:remote
```

Verifica que el comando apunta a `cv-studio-db` antes de confirmar.

## Favicons

Los favicons personalizados del proyecto deben permanecer en la raíz:

- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
