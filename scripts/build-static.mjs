import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const output = path.join(root, ".dev-static");

// No eliminamos .dev-static.
// En Windows puede estar siendo utilizada por Wrangler durante desarrollo.
fs.mkdirSync(output, {
  recursive: true
});

copyFile("index.html");
copyFile("app.html");

copyDirectory("css");
copyDirectory("js");
copyDirectory("assets");
copyDirectory("templates");

console.log("[build] Recursos web preparados en .dev-static");

function copyFile(relativePath) {
  const source = path.join(root, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`No existe el archivo obligatorio: ${relativePath}`);
  }

  const destination = path.join(output, relativePath);

  fs.mkdirSync(path.dirname(destination), {
    recursive: true
  });

  fs.copyFileSync(source, destination);
}

function copyDirectory(relativePath) {
  const source = path.join(root, relativePath);

  if (!fs.existsSync(source)) {
    return;
  }

  const destination = path.join(output, relativePath);

  fs.mkdirSync(destination, {
    recursive: true
  });

  fs.cpSync(source, destination, {
    recursive: true,
    force: true
  });
}