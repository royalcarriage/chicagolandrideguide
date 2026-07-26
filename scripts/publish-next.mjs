#!/usr/bin/env node
/**
 * Publish the next queued topic from content/queue.json into content/posts/.
 * Zero-cost LLM policy: scripts/free-llm.mjs (Gemini free → template fallback).
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, today, slugify, write } from "./lib.mjs";
import { freeComplete, zeroCostMode } from "./free-llm.mjs";

const queuePath = path.join(ROOT, "content/queue.json");
const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const next = (queue.posts || []).find((p) => p.status === "queued");

if (!next) {
  console.log("No queued posts. Add items to content/queue.json with status: queued");
  process.exit(0);
}

const slug = next.slug || slugify(next.title);
const date = today();
const outline = next.outline || ["What it costs", "What changes the price", "How to book it right", "Mistakes to avoid"];

let body;
let llmMeta = { provider: "template", costUsd: 0 };
if (process.env.AF_USE_LLM === "0") {
  body = generateTemplate(next, outline);
} else {
  const result = await generateWithFreeLlm(next, outline);
  body = result.body;
  llmMeta = result.meta;
}

const md = `---
title: "${escapeYaml(next.title)}"
description: "${escapeYaml(next.description || next.title)}"
date: "${date}"
slug: "${slug}"
tags: [${(next.tags || []).map((t) => `"${t}"`).join(", ")}]
hub: "${next.hub || "/guides/"}"
status: published
source: content-pipeline
llm_provider: "${llmMeta.provider}"
llm_cost_usd: ${llmMeta.costUsd || 0}
zero_cost_mode: ${zeroCostMode()}
---

${body}
`;

const outRel = `content/posts/${slug}.md`;
if (fs.existsSync(path.join(ROOT, outRel))) {
  console.error(`Post already exists: ${outRel}`);
  process.exit(1);
}
write(outRel, md);

next.status = "published";
next.published_at = date;
next.published_path = outRel;
next.llm_provider = llmMeta.provider;
fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      published: slug,
      path: outRel,
      llm: llmMeta,
      zeroCost: zeroCostMode(),
      remaining: queue.posts.filter((p) => p.status === "queued").length,
    },
    null,
    2
  )
);

function generateTemplate(item, outline) {
  const lines = [];
  lines.push(
    `**Direct answer:** ${item.description || item.title} Below is what Chicagoland trips like this actually involve — costs, timing, and how to book without overpaying.`
  );
  lines.push("");
  for (const section of outline) {
    lines.push(`## ${section}`);
    lines.push("");
    lines.push(
      `${section}: plan this against real Chicago conditions — traffic on the Kennedy/Dan Ryan, venue load-in rules, and seasonal demand (prom in May, weddings June–October, holiday parties in December).`
    );
    lines.push("");
    lines.push(
      `- Confirm pickup windows in writing\n- Ask for all-in pricing (fuel, gratuity, tolls)\n- Related hub: [${item.hub || "/guides/"}](${item.hub || "/guides/"})`
    );
    lines.push("");
  }
  lines.push("## Next step");
  lines.push("");
  lines.push(
    `Compare options on the [cost data hub](/costs/), or get a live quote from a licensed operator — see [how we make money](/legal/affiliate-disclosure/). More posts: [blog](/blog/).`
  );
  return lines.join("\n");
}

async function generateWithFreeLlm(item, outline) {
  const prompt = `Write a markdown article for Chicagoland Ride Guide, an independent site about ground-transportation costs and planning in Chicago and its suburbs. Readers are locals planning real trips (weddings, proms, nights out, airport runs, corporate events).

Title: ${item.title}
Description: ${item.description || ""}
Outline sections:
${outline.map((o) => `- ${o}`).join("\n")}
Hub path: ${item.hub || "/guides/"}

Voice rules (strict):
- Start with **Direct answer:** one specific paragraph (40-60 words) a search engine could quote verbatim, including a realistic dollar range where relevant.
- Use ## for each outline section.
- Every section must contain at least one CONCRETE element: a realistic price range, an exact step, a named Chicago place/venue/route (O'Hare, Midway, the Loop, Naperville, Schaumburg, the Kennedy, etc.), a short example, or a checklist.
- Price guidance must be REALISTIC RANGES for the Chicago market, clearly framed as typical ranges ("most 4-hour party bus rentals in Chicagoland run $X–$Y"), never fake precision or invented "surveys".
- Where options are compared (vehicle types, hourly vs transfer pricing), use a small markdown table with real criteria.
- BANNED words/phrases: seamless, seamlessly, robust, crucial, comprehensive, leverage, elevate, delve, landscape, game-changer, unlock, supercharge, luxurious experience, "in today's world", "it's essential to", "look no further", nestled.
- No invented statistics, no fake reviews, no operator bashing.
- Write like a local planner sharing working knowledge, not a brochure.
- End with a "## Next step" section linking the hub path, /costs/, and /legal/affiliate-disclosure/.
- 900–1300 words.`;

  try {
    const r = await freeComplete(prompt, { maxTokens: 2600 });
    if (r.text && r.text.length > 200) {
      return {
        body: r.text,
        meta: { provider: r.provider, costUsd: 0 },
      };
    }
    console.warn("Free LLM empty/short; using template. errors=", r.errors || []);
  } catch (e) {
    console.warn("Free LLM failed; using template:", e.message);
  }
  return { body: generateTemplate(item, outline), meta: { provider: "template", costUsd: 0 } };
}

function escapeYaml(s) {
  return String(s).replace(/"/g, '\\"');
}
