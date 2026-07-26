#!/usr/bin/env node
/**
 * Normalize every page's canonical + og:url to the PRIMARY host (Vercel).
 * The GH Pages mirror then defers to Vercel instead of competing with it —
 * before this, 66 pages self-canonicalized to github.io and split indexing.
 *
 * Idempotent. Run after adding hand-written pages: node scripts/fix-canonicals.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRIMARY = (process.env.SITE_URL || "https://chicagolandrideguide.com").replace(/\/$/, "");
const SKIP = new Set([".git", "node_modules", "dist", ".vercel", "_agent_staging"]);

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

function urlPathFor(absFile) {
  let rel = path.relative(ROOT, absFile).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel}`;
}

let changed = 0;
let inserted = 0;
for (const file of walk(ROOT)) {
  // GSC verification file and similar single-purpose files: leave alone
  if (/^google[0-9a-f]+\.html$/.test(path.basename(file))) continue;
  const url = `${PRIMARY}${urlPathFor(file)}`;
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${url}" />`
    );
  } else if (html.includes("</head>")) {
    html = html.replace("</head>", `  <link rel="canonical" href="${url}" />\n</head>`);
    inserted++;
  }

  if (/<meta\s+property="og:url"/.test(html)) {
    html = html.replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${url}" />`
    );
  }

  if (html !== before) {
    fs.writeFileSync(file, html);
    changed++;
  }
}
console.log(`fix-canonicals: primary=${PRIMARY} changed=${changed} inserted=${inserted}`);
