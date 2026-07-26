import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// chicagolandrideguide.com is the canonical host from day one.
// Until DNS lands, GH Pages previews may look path-broken — that's expected.
export const SITE = process.env.SITE_URL || "https://chicagolandrideguide.com";
export const BASE = process.env.BASE_PATH || "";
export const NAME = "Chicagoland Ride Guide";

// Referral partner (disclosed on every page + /legal/affiliate-disclosure/).
export const RCL_BOOK = "https://royalcarriagelimo.com/book-now/?utm_source=chicagolandrideguide&utm_medium=referral";
export const RCL_TEL = "tel:+12248013090";
export const RCL_TEL_LABEL = "(224) 801-3090";

export function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

export function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

export function listPostFiles() {
  const dir = path.join(ROOT, "content/posts");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

/** Minimal frontmatter + body parser */
export function parsePost(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Invalid post frontmatter: ${filePath}`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    meta[key] = val;
  }
  return { meta, body: m[2].trim(), filePath };
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function mdToHtml(md) {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // fenced code
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
  // headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, (_, t) => {
    const id = slugify(t);
    return `<h2 id="${id}">${t}</h2>`;
  });
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // pipe tables → real tables (cost data lives in tables)
  html = html.replace(/(?:^\|.+\|\s*$\n?)+/gm, (block) => {
    const rows = block.trim().split("\n").map((r) => r.trim());
    const cells = rows
      .filter((r) => !/^\|[\s:|-]+\|$/.test(r))
      .map((r) => r.slice(1, -1).split("|").map((c) => c.trim()));
    if (!cells.length) return block;
    const [head, ...body] = cells;
    return `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body
      .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  });
  // bold / italic / code / links
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // lists
  html = html.replace(/(?:^|\n)- (.+)(?=\n|$)/g, "\n<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?:\s*<li>[\s\S]*?<\/li>)+/g, (block) => {
    return `<ul>${block.replace(/\n+/g, "")}</ul>`;
  });
  // paragraphs
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      if (t.startsWith("<h") || t.startsWith("<ul") || t.startsWith("<pre") || t.startsWith("<table") || t.startsWith("<li")) return t;
      return `<p>${t.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");
  return html;
}

export function pageShell({ title, description, path: p, body, schema }) {
  const can = `${SITE}${p}`;
  const schemaTag = schema
    ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
    : "";
  const nav = [
    ["/", "Home"],
    ["/costs/", "Costs"],
    ["/guides/", "Guides"],
    ["/events/", "Events"],
    ["/venues/", "Venues"],
    ["/blog/", "Blog"],
  ]
    .map(([href, label]) => {
      const active =
        href === p || (href !== "/" && p.startsWith(href)) ? " is-active" : "";
      return `<a href="${BASE}${href}" class="nav-link${active}">${label}</a>`;
    })
    .join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${can}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta name="theme-color" content="#0b0d10" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${NAME}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${can}" />
  <meta name="twitter:card" content="summary" />
  <link rel="stylesheet" href="${BASE}/css/styles.css" />
  ${schemaTag}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="logo" href="${BASE}/">${NAME}<span class="logo-mark">🚘</span></a>
      <nav class="nav" aria-label="Primary">
          ${nav}
      </nav>
      <a class="btn btn-sm" href="${RCL_BOOK}" rel="sponsored noopener">Book a ride</a>
    </div>
  </header>
  <aside class="disclosure-bar" role="note">
    <div class="wrap">
      Independent guide. Booking links are referrals to local operators, including Royal Carriage Limousine.
      <a href="${BASE}/legal/affiliate-disclosure/">How we make money</a>
    </div>
  </aside>
  <main id="main">
${body}
  </main>
  <section class="section"><div class="wrap">
    <div class="cta-band">
      <p><strong>Need a quote for a real trip?</strong> Skip the research — call a licensed Chicagoland operator:
      <a href="${RCL_TEL}" rel="sponsored">${RCL_TEL_LABEL}</a> or
      <a href="${RCL_BOOK}" rel="sponsored noopener">book online</a>.</p>
    </div>
  </div></section>
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <strong>${NAME}</strong>
        <p class="muted">Real cost data and planning guides for limos, party buses, and car service across Chicago and the suburbs.</p>
      </div>
      <div>
        <h3>Explore</h3>
        <ul class="footer-links">
          <li><a href="${BASE}/costs/">Cost data</a></li>
          <li><a href="${BASE}/guides/">Planning guides</a></li>
          <li><a href="${BASE}/events/">Events</a></li>
          <li><a href="${BASE}/venues/">Venues</a></li>
        </ul>
      </div>
      <div>
        <h3>Site</h3>
        <ul class="footer-links">
          <li><a href="${BASE}/blog/">Blog</a></li>
          <li><a href="${BASE}/about/">About</a></li>
          <li><a href="${BASE}/contact/">Contact</a></li>
        </ul>
      </div>
      <div>
        <h3>Legal</h3>
        <ul class="footer-links">
          <li><a href="${BASE}/legal/affiliate-disclosure/">How we make money</a></li>
          <li><a href="${BASE}/legal/privacy/">Privacy</a></li>
        </ul>
      </div>
    </div>
    <div class="wrap footer-bottom">
      <span>© ${new Date().getFullYear()} ${NAME}</span>
      <a href="${BASE}/sitemap.xml">Sitemap</a>
      <a href="${BASE}/llms.txt">llms.txt</a>
    </div>
  </footer>
  <script src="${BASE}/js/config.js"></script>
  <script src="${BASE}/js/ads.js" defer></script>
  <div class="af-ad af-ad-auto wrap" aria-hidden="true" style="min-height:0;margin:1rem auto;max-width:728px"></div>
</body>
</html>
`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function prefixBodyLinks(html) {
  if (!BASE) return String(html);
  return String(html).replace(/(href=")\/(?!\/|https?:)/g, `$1${BASE}/`);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
