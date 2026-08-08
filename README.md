# OpenTrust CV Portal

Portal privado para gestionar, versionar y compartir el CV mediante enlaces temporales.

## Estructura web

- `index.html`: pantalla de acceso.
- `app.html`: aplicación privada.
- `src/`: Worker y lógica de API.
- `migrations/`: migraciones D1.
- `scripts/`: utilidades exclusivas de desarrollo local.

## Desarrollo local

1. `npm install`
2. Copia `.dev.vars.example` a `.dev.vars` y define al menos `ADMIN_PASSWORD` y `SESSION_SECRET`.
3. `npm run dev`
4. Abre `http://127.0.0.1:10060/`.

`app.html` y las API privadas requieren sesión. Los secretos, la base local, PDFs y recursos generados están excluidos de Git.

> El renderer PDF con Edge y el relay SMTP de `scripts/` son servicios de desarrollo local. Antes del despliegue definitivo en Cloudflare se configurarán sus equivalentes de producción.


## Acceso al portal

Esta versión no implementa contraseña ni sesión propias. `/` es una portada de acceso y `/app.html` contiene la aplicación. En producción, protege `/app.html` y las API administrativas con Cloudflare Access. Los enlaces públicos de descarga `/download/*` deben quedar fuera de esa política para que los destinatarios puedan descargar su CV mediante el token temporal.
"# CvStudio" 
