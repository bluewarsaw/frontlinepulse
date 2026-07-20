"use strict";
/**
 * Start Next.js na CloudLinux / DirectAdmin (seohost).
 * Ładuje .env z katalogu aplikacji PRZED startem Next.
 * Startup file w panelu: server.js
 */
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");
const { createServer } = require("http");
const { parse } = require("url");

const root = __dirname;

// CloudLinux: upewnij się że cwd = katalog aplikacji (moduły npm, .env)
process.chdir(root);

function loadEnv() {
  const p = join(root, ".env");
  if (!existsSync(p)) {
    console.warn("[frontline] UWAGA: brak pliku .env w", root);
    return;
  }
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
  console.log(
    "[frontline] .env OK, DATABASE_URL:",
    process.env.DATABASE_URL ? "ustawiony" : "BRAK!"
  );
}

loadEnv();
process.env.NODE_ENV = "production";

const next = require("next");
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: root });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsed = parse(req.url, true);
      handle(req, res, parsed).catch((err) => {
        console.error("[frontline] request error:", parsed.pathname, err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      });
    }).listen(port, "0.0.0.0", (err) => {
      if (err) throw err;
      console.log(`[frontline] Ready http://0.0.0.0:${port} cwd=${process.cwd()}`);
    });
  })
  .catch((err) => {
    console.error("[frontline] Start failed:", err);
    process.exit(1);
  });
