#!/usr/bin/env node
import { SITE, listPostFiles, parsePost, write } from "./lib.mjs";

const staticUrls = [
  "/",
  "/about/",
  "/costs/",
  "/guides/",
  "/events/",
  "/venues/",
  "/blog/",
  "/contact/",
  "/legal/",
  "/legal/privacy/",
  "/legal/affiliate-disclosure/",
];

const posts = listPostFiles()
  .map(parsePost)
  .filter((p) => (p.meta.status || "published") !== "draft");

const urls = [...staticUrls, ...posts.map((p) => `/blog/${p.meta.slug}/`)];

const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const depth = u.split("/").filter(Boolean).length;
    const priority = u === "/" ? "1.0" : depth <= 1 ? "0.8" : "0.6";
    return `  <url>
    <loc>${SITE}${u}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>
`;

write("sitemap.xml", xml);

// refresh llms.txt blog list
const llms = `# Chicagoland Ride Guide
> Independent guide to ground transportation costs, planning, and venues across Chicagoland.
> Real price data, event logistics, and vehicle guides for Chicago and its suburbs.

## Primary
- ${SITE}/
- ${SITE}/costs/
- ${SITE}/guides/
- ${SITE}/events/
- ${SITE}/venues/
- ${SITE}/blog/

## Blog posts
${posts.map((p) => `- ${SITE}/blog/${p.meta.slug}/`).join("\n")}
`;
write("llms.txt", llms);
console.log(`sitemap: ${urls.length} URLs`);
