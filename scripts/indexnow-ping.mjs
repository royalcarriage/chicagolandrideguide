#!/usr/bin/env node
/**
 * IndexNow ping — free, no-auth URL submission to Bing/Seznam/Yandex/Naver
 * (feeds Bing index → DuckDuckGo + Microsoft Copilot citations).
 *
 * Key file <key>.txt lives at site root (committed). Google ignores IndexNow;
 * GSC sitemap submission is the Google path (owner gate — see runbook).
 *
 * Usage:
 *   node scripts/indexnow-ping.mjs --all            # every sitemap URL
 *   node scripts/indexnow-ping.mjs --recent 5       # newest N posts + hubs
 *   node scripts/indexnow-ping.mjs --urls /a/,/b/   # explicit paths or URLs
 *
 * Always exits 0 — distribution pings must never fail a pipeline.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE_URL || "https://chicagolandrideguide.com").replace(/\/$/, "");
const HOST = new URL(SITE).host;

function findKey() {
  for (const f of fs.readdirSync(ROOT)) {
    if (/^[0-9a-f]{32}\.txt$/.test(f)) {
      const body = fs.readFileSync(path.join(ROOT, f), "utf8").trim();
      if (body === f.replace(/\.txt$/, "")) return body;
    }
  }
  return null;
}

function sitemapUrls() {
  try {
    const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

function recentUrls(n) {
  const dir = path.join(ROOT, "content/posts");
  let posts = [];
  try {
    posts = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        const raw = fs.readFileSync(path.join(dir, f), "utf8");
        const slug = raw.match(/^slug:\s*"?([^"\n]+)"?/m)?.[1];
        const date = raw.match(/^date:\s*"?([^"\n]+)"?/m)?.[1] || "";
        return slug ? { slug, date } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, n)
      .map((p) => `${SITE}/blog/${p.slug}/`);
  } catch {
    /* no posts */
  }
  return [SITE + "/", `${SITE}/blog/`, ...posts];
}

const args = process.argv.slice(2);
let urls = [];
if (args.includes("--all")) {
  urls = sitemapUrls();
} else if (args.includes("--urls")) {
  const raw = args[args.indexOf("--urls") + 1] || "";
  urls = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((u) => (u.startsWith("http") ? u : SITE + u));
} else {
  const n = Number(args[args.indexOf("--recent") + 1]) || 5;
  urls = recentUrls(n);
}
urls = [...new Set(urls)].filter((u) => u.includes(HOST)).slice(0, 10000);

const key = findKey();
if (!key) {
  console.log("indexnow: no key file at root — skipping");
  process.exit(0);
}
if (!urls.length) {
  console.log("indexnow: no URLs to submit — skipping");
  process.exit(0);
}

try {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation: `${SITE}/${key}.txt`,
      urlList: urls,
    }),
  });
  console.log(`indexnow: ${res.status} for ${urls.length} URLs (host=${HOST})`);
} catch (e) {
  console.log(`indexnow: failed (non-fatal): ${e.message || e}`);
}
process.exit(0);
