#!/usr/bin/env node
/**
 * Daily autonomous cycle — Chicagoland Ride Guide.
 * Zero paid APIs. Health check → Gemini plan → keep topic queue full →
 * publish (until the site reaches cruising volume) → rebuild → state/log.
 * Runs in GitHub Actions; commits are handled by the workflow.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { ROOT, SITE, slugify } from "./lib.mjs";

const now = new Date().toISOString();
const today = now.slice(0, 10);

function readJson(rel, fb) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch {
    return fb;
  }
}
function writeJson(rel, obj) {
  fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(obj, null, 2) + "\n");
}

async function gemini(prompt, maxTokens = 1200) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  for (const m of [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
  ]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.6 },
          }),
        }
      );
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
      if (text) return text;
    } catch {
      /* next model */
    }
  }
  return null;
}

// 1) Health
const health = {};
for (const p of ["/", "/costs/", "/blog/", "/sitemap.xml", "/ads.txt"]) {
  try {
    health[p] = execSync(
      `curl -sS -o /dev/null -w "%{http_code}" -L --max-time 12 "${SITE}${p}"`,
      { encoding: "utf8" }
    ).trim();
  } catch {
    health[p] = "ERR";
  }
}

const queue = readJson("content/queue.json", { posts: [] });
const posts = queue.posts || [];
const published = posts.filter((p) => p.status === "published");
let queued = posts.filter((p) => p.status === "queued");
const actions = [];

// 2) Keep the queue full — ask Gemini for fresh long-tail Chicagoland topics.
// Guardrail baked into the prompt: informational intent only; never chase
// "[suburb] limo service"-style commercial terms (those belong to the operator sites).
if (queued.length < 6) {
  const covered = posts.map((p) => p.slug || p.id).join(", ");
  const ideas = await gemini(
    `You plan content for Chicagoland Ride Guide — an independent info site on ground-transportation costs and planning in Chicago and suburbs (party bus, limo, sprinter, car service, shuttles).
Already covered: ${covered || "(nothing yet)"}.
Propose 6 NEW long-tail INFORMATIONAL topics locals actually search (costs, planning, timelines, event/venue logistics, seasonal: prom May, weddings Jun-Oct, holiday Dec, Lollapalooza Aug, Bears season).
NEVER propose commercial service-page topics like "best limo service in <suburb>" or "<city> limo rental" — informational angles only.
Return STRICT JSON array: [{"title":"...","description":"...","hub":"/costs/|/guides/|/events/|/venues/","tags":["..."],"outline":["...","...","...","..."]}] — nothing else.`,
    1600
  );
  let added = 0;
  if (ideas) {
    try {
      const parsed = JSON.parse(ideas.replace(/^```json?\s*|\s*```$/g, ""));
      const ids = new Set(posts.map((p) => p.id || p.slug));
      for (const t of parsed.slice(0, 6)) {
        const slug = slugify(t.title);
        if (!t.title || ids.has(slug)) continue;
        posts.push({
          id: slug,
          slug,
          title: t.title,
          description: t.description || "",
          tags: Array.isArray(t.tags) ? t.tags.slice(0, 5) : [],
          hub: ["/costs/", "/guides/", "/events/", "/venues/"].includes(t.hub) ? t.hub : "/guides/",
          outline: Array.isArray(t.outline) && t.outline.length ? t.outline.slice(0, 6) : undefined,
          status: "queued",
          source: "daily-cycle",
        });
        ids.add(slug);
        added++;
      }
    } catch (e) {
      actions.push({ step: "seed_topics", ok: false, error: String(e.message || e).slice(0, 200) });
    }
  }
  if (added) {
    queue.posts = posts;
    writeJson("content/queue.json", queue);
    queued = posts.filter((p) => p.status === "queued");
  }
  actions.push({ step: "seed_topics", ok: true, added });
}

// 3) Publish daily until cruising volume, then let Tue/Fri pipeline carry it.
const CRUISE_AT = 40;
let publishedNow = null;
if (queued.length > 0 && published.length < CRUISE_AT) {
  try {
    const out = execSync("node scripts/publish-next.mjs", {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        AF_ZERO_COST: "1",
        AF_USE_LLM: process.env.GEMINI_API_KEY ? "1" : "0",
        SITE_URL: SITE,
        BASE_PATH: "",
      },
    });
    publishedNow = out.trim().slice(0, 400);
    actions.push({ step: "publish", ok: true });
  } catch (e) {
    actions.push({ step: "publish", ok: false, error: String(e.message || e).slice(0, 300) });
  }
} else {
  actions.push({ step: "publish", ok: true, skipped: published.length >= CRUISE_AT ? "cruise volume reached" : "queue empty" });
}

// 4) Rebuild site artifacts
try {
  execSync("node scripts/build-blog.mjs && node scripts/build-sitemap.mjs && node scripts/fix-canonicals.mjs", {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SITE_URL: SITE, BASE_PATH: "" },
  });
  actions.push({ step: "rebuild", ok: true });
} catch (e) {
  actions.push({ step: "rebuild", ok: false, error: String(e.message || e).slice(0, 300) });
}

// 5) State + log
const state = readJson("agents/company-state.json", {});
state.cycleCount = (state.cycleCount || 0) + 1;
state.lastCycle = {
  at: now,
  health,
  queued: readJson("content/queue.json", { posts: [] }).posts.filter((p) => p.status === "queued").length,
  published: readJson("content/queue.json", { posts: [] }).posts.filter((p) => p.status === "published").length,
  publishedNow: Boolean(publishedNow),
};
writeJson("agents/company-state.json", state);
fs.mkdirSync(path.join(ROOT, "agents/logs"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, `agents/logs/cycle-${today}.json`),
  JSON.stringify({ at: now, health, actions, publishedNow }, null, 2) + "\n"
);

console.log(JSON.stringify({ ok: true, cycle: state.cycleCount, health, actions }, null, 2));
