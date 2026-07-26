#!/usr/bin/env node
/**
 * Manual scaffold: node scripts/new-post.mjs "My Title"
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, today, slugify, write } from "./lib.mjs";

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Usage: node scripts/new-post.mjs "Post title"');
  process.exit(1);
}
const slug = slugify(title);
const rel = `content/posts/${slug}.md`;
if (fs.existsSync(path.join(ROOT, rel))) {
  console.error("Exists:", rel);
  process.exit(1);
}
write(
  rel,
  `---
title: "${title.replace(/"/g, '\\"')}"
description: "${title.replace(/"/g, '\\"')}"
date: "${today()}"
slug: "${slug}"
tags: ["seo"]
hub: "/blog/"
status: draft
---

**Direct answer:** TODO

## Section

Write the post, set status to published, then run \`npm run build\`.
`
);
console.log("created", rel);
