import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(projectRoot, ".dev-static");
const nodeExecutable = process.execPath;
const wranglerCli = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");

prepareStaticAssets({ clean: true });
applyPendingMigrations();

const processes = [
  {
    name: "pdf-renderer",
    command: nodeExecutable,
    args: [path.join(projectRoot, "scripts", "pdf-renderer.mjs")]
  },
  {
    name: "wrangler",
    command: nodeExecutable,
    args: [wranglerCli, "dev", "--local", "--port", "10060"]
  }
];


const children = [];
let closing = false;

for (const processConfig of processes) {
  const child = spawn(processConfig.command, processConfig.args, {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: false,
    shell: false,
    env: process.env
  });

  child.processName = processConfig.name;
  children.push(child);

  child.on("error", (error) => {
    console.error(`[dev] No se pudo iniciar ${processConfig.name}:`, error);
    stop(1);
  });

  child.on("exit", (code, signal) => {
    if (closing) return;
    if (code !== 0) {
      console.error(
        `[dev] ${processConfig.name} terminó inesperadamente` +
          (signal ? ` por la señal ${signal}.` : ` con código ${code}.`)
      );
      stop(code || 1);
    }
  });
}

/**
 * clean:true (solo al arrancar, antes de lanzar Wrangler) borra y recrea
 * .dev-static entera. clean:false (cada resincronización posterior, con
 * Wrangler ya corriendo) NUNCA borra el directorio — solo sobrescribe los
 * archivos en su sitio. Wrangler vigila .dev-static por su cuenta para
 * recargar en caliente; en Windows, borrar y recrear una carpeta que otro
 * proceso está vigilando es una carrera de bloqueos de directorio que a
 * veces pierde (EPERM) y puede dejarla momentáneamente vacía — de ahí el
 * 404 intermitente. Sobrescribir sin borrar evita esa carrera por completo.
 */
function prepareStaticAssets({ clean = false } = {}) {
  if (clean) {
    removeDirectoryWithRetry(staticDir);
  }
  fs.mkdirSync(staticDir, { recursive: true });

  copyRequired("index.html");
  copyRequired("app.html");
  copyOptionalFile("favicon.ico");
  copyOptionalFile("favicon-16x16.png");
  copyOptionalFile("favicon-32x32.png");
  copyOptionalFile("apple-touch-icon.png");
  copyOptionalFile("android-chrome-192x192.png");
  copyOptionalFile("android-chrome-512x512.png");
  copyOptionalDirectory("css");
  copyOptionalDirectory("js");
  copyOptionalDirectory("assets");
  fs.writeFileSync(path.join(staticDir, ".assetsignore"), "templates\n*.map\n*.md\n.DS_Store\nThumbs.db\n", "utf8");

  console.log("[dev] Recursos web preparados en .dev-static");
}

/**
 * En Windows, un proceso anterior (otra terminal con 'npm run dev' que
 * acabas de cerrar) puede tardar un instante en soltar el bloqueo del
 * directorio. Reintenta unas pocas veces con una pausa corta antes de
 * rendirse, en vez de tirar el arranque entero por una condición transitoria.
 */
function removeDirectoryWithRetry(dir, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      sleepSync(150);
    }
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Los recursos web se preparan una sola vez al arrancar.
 *
 * No usamos fs.watch() sobre HTML/CSS/JS porque en algunas unidades Windows
 * o compartidas (como Z:) los eventos de cambio pueden retroalimentarse al
 * copiar archivos a .dev-static y provocar un bucle de recargas.
 *
 * Si cambias recursos frontend durante desarrollo, reinicia `npm run dev`.
 */
function copyRequired(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(staticDir, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`No se encuentra el archivo obligatorio: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyOptionalFile(relativePath) {
  const source = path.join(projectRoot, relativePath);
  if (!fs.existsSync(source)) return;
  const destination = path.join(staticDir, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyOptionalDirectory(relativePath) {
  const source = path.join(projectRoot, relativePath);
  if (!fs.existsSync(source)) return;
  // force:true (por defecto en cpSync) sobrescribe los archivos existentes
  // sin necesidad de borrar el directorio destino primero.
  fs.cpSync(source, path.join(staticDir, relativePath), { recursive: true, force: true });
}

function stop(exitCode = 0) {
  if (closing) return;
  closing = true;

  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }

  setTimeout(() => process.exit(exitCode), 400);
}

/**
 * Cada migración nueva en migrations/ hay que aplicarla a mano con
 * 'npm run db:init' — fácil de olvidar, y el fallo (D1_ERROR: no such
 * column...) solo se ve mucho después, al usar la función nueva. Se aplica
 * aquí sola, en cada arranque, contra la D1 local; es idempotente (las ya
 * aplicadas se ignoran), así que no hace daño ejecutarlo de más.
 */
function applyPendingMigrations() {
  const databaseName = readD1DatabaseName();
  if (!databaseName) {
    console.warn("[dev] No se encontró d1_databases en wrangler.jsonc; omito la aplicación automática de migraciones.");
    return;
  }
  console.log(`[dev] Aplicando migraciones pendientes de D1 (${databaseName}, local)…`);
  const result = spawnSync(
    nodeExecutable,
    [wranglerCli, "d1", "migrations", "apply", databaseName, "--local"],
    { cwd: projectRoot, stdio: "inherit", shell: false, env: { ...process.env, CI: "true" } }
  );
  if (result.status !== 0) {
    console.warn("[dev] No se pudieron aplicar las migraciones automáticamente. Revisa el mensaje anterior; puedes reintentarlo con 'npm run db:init'.");
  }
}

function readD1DatabaseName() {
  try {
    const raw = fs.readFileSync(path.join(projectRoot, "wrangler.jsonc"), "utf8");
    const withoutComments = raw.replace(/^\s*\/\/.*$/gm, "");
    const config = JSON.parse(withoutComments);
    return config.d1_databases?.[0]?.database_name || null;
  } catch (error) {
    console.warn("[dev] No se pudo leer wrangler.jsonc para localizar la base de datos D1:", error.message);
    return null;
  }
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
process.on("uncaughtException", (error) => {
  console.error("[dev] Error no controlado:", error);
  stop(1);
});
