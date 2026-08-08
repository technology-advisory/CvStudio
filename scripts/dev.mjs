import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(projectRoot, ".dev-static");
const nodeExecutable = process.execPath;
const wranglerCli = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");

prepareStaticAssets({ clean: true });
watchStaticAssets();
applyPendingMigrations();

const processes = [
  {
    name: "pdf-renderer",
    command: nodeExecutable,
    args: [path.join(projectRoot, "scripts", "pdf-renderer.mjs")]
  },
  ...(hasLocalSmtpConfig()
    ? [{ name: "mail-relay", command: nodeExecutable, args: [path.join(projectRoot, "scripts", "smtp-relay.mjs")] }]
    : []),
  {
    name: "wrangler",
    command: nodeExecutable,
    args: [wranglerCli, "dev", "--local", "--port", "10060"]
  }
];

if (!hasLocalSmtpConfig()) {
  console.log("[dev] SMTP no configurado · mail-relay desactivado");
}

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
  copyOptionalDirectory("css");
  copyOptionalDirectory("js");
  copyOptionalDirectory("assets");
  copyOptionalDirectory("templates");

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
 * index.html, app.html, css/, js/, assets/ y templates/ solo se copian a
 * .dev-static una vez, al arrancar — a diferencia de src/ (el Worker), que
 * wrangler recarga solo en cada guardado. Sin este watcher, un cambio en
 * cualquier .js o .css del navegador se queda invisible hasta reiniciar
 * 'npm run dev' a mano, y eso es fácil de olvidar. Aquí lo mantenemos
 * sincronizado mientras el servidor está corriendo — siempre con
 * clean:false (ver prepareStaticAssets).
 */
function watchStaticAssets() {
  const targets = ["index.html", "app.html", "css", "js", "assets", "templates"];
  let pending = null;
  const resync = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      try {
        prepareStaticAssets({ clean: false });
        console.log("[dev] Recursos web actualizados (cambio detectado)");
      } catch (error) {
        console.error("[dev] No se pudieron actualizar los recursos estáticos:", error.message);
      }
    }, 150);
  };

  for (const target of targets) {
    const fullPath = path.join(projectRoot, target);
    if (!fs.existsSync(fullPath)) continue;
    try {
      fs.watch(fullPath, { recursive: true }, resync);
    } catch {
      // 'recursive' no soportado en este SO/versión de Node (típico en Linux
      // antiguo); nos quedamos con la vigilancia no recursiva del nivel raíz.
      fs.watch(fullPath, resync);
    }
  }
}

function copyRequired(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(staticDir, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`No se encuentra el archivo obligatorio: ${relativePath}`);
  }
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

function hasLocalSmtpConfig() {
  const file = path.join(projectRoot, ".dev.vars");
  if (!fs.existsSync(file)) return false;
  const vars = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    vars[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"].every((name) => Boolean(vars[name]));
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
