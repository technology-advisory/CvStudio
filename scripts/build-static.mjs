import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".dev-static");
fs.mkdirSync(output, { recursive: true });
for (const file of ["index.html", "app.html"]) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) throw new Error(`No existe ${file}`);
  fs.copyFileSync(src, path.join(output, file));
}
for (const file of ["favicon.ico", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "android-chrome-192x192.png", "android-chrome-512x512.png"]) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(output, file));
}
for (const dir of ["css","js","assets","templates"]) {
  const src=path.join(root,dir); if(fs.existsSync(src)) fs.cpSync(src,path.join(output,dir),{recursive:true,force:true});
}
console.log("[build] Recursos web preparados en .dev-static");
