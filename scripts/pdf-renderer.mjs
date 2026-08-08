import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const PORT = Number(process.env.CV_PDF_RENDERER_PORT || 10062);
const MAX_BODY = 8 * 1024 * 1024;

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true, browser: findBrowser() });
  }
  if (req.method !== "POST" || req.url !== "/render-pdf") {
    return json(res, 404, { error: "Not found" });
  }

  try {
    const payload = JSON.parse(await readBody(req));
    const html = String(payload?.html || "");
    if (!html.trim()) return json(res, 400, { error: "Falta el HTML a renderizar." });

    const browser = findBrowser();
    if (!browser) {
      return text(res, 503,
        "No encuentro Microsoft Edge ni Google Chrome. Instala uno de ellos o configura CV_BROWSER_PATH con la ruta del ejecutable."
      );
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "opentrust-cv-"));
    const htmlPath = path.join(tempDir, "cv.html");
    const pdfPath = path.join(tempDir, "cv.pdf");
    fs.writeFileSync(htmlPath, html, "utf8");

    try {
      await printToPdf(browser, htmlPath, pdfPath);
      if (!fs.existsSync(pdfPath)) throw new Error("El navegador no generó el archivo PDF.");
      const pdf = fs.readFileSync(pdfPath);
      if (pdf.length < 5 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new Error("El resultado generado no es un PDF válido.");
      }
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-length": String(pdf.length),
        "cache-control": "no-store"
      });
      res.end(pdf);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error("[pdf-renderer]", error);
    text(res, 500, error instanceof Error ? error.message : String(error));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const browser = findBrowser();
  console.log(`[pdf-renderer] http://127.0.0.1:${PORT} · ${browser || "navegador no encontrado"}`);
});

function printToPdf(browser, htmlPath, pdfPath) {
  const uri = new URL(`file:///${htmlPath.replace(/\\/g, "/")}`).href;
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-pdf-header-footer",
    `--print-to-pdf=${pdfPath}`,
    uri
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(browser, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Edge/Chrome terminó con código ${code}. ${stderr}`.trim()));
    });
  });
}

function findBrowser() {
  const candidates = [
    process.env.CV_BROWSER_PATH,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("La petición es demasiado grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function setCors(res) {
  res.setHeader("access-control-allow-origin", "http://127.0.0.1:10060");
  res.setHeader("access-control-allow-methods", "POST, GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("cache-control", "no-store");
}
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
function text(res, status, body) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(String(body));
}
