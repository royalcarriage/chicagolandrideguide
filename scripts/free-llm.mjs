#!/usr/bin/env node
/**
 * Zero-cost LLM router for AuthorityForge.
 *
 * Order (AF_ZERO_COST=1 default):
 *   1) Ollama local — truly $0, no cloud bill
 *   2) Gemini free tier — GEMINI_API_KEY (Google free quota)
 *   3) Vercel AI Gateway FREE models only — AI_GATEWAY_API_KEY / VERCEL_AI_GATEWAY_API_KEY
 *      Only models with $0 input+output pricing (e.g. *-free). Never paid catalog.
 *   4) OpenCode free (if available)
 *   5) template (caller handles)
 *
 * NEVER uses paid gateway models while zero-cost is on.
 * Force: AF_LLM_PROVIDER=ollama|gemini|vercel|opencode|none
 *
 * Vercel free-tier note: AI Gateway may require a card on file to unlock the
 * $5/mo free credits, but FREE models are $0/$0 pricing — still set AF_ZERO_COST
 * and only call free models so spend stays $0 after verification.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ZERO =
  process.env.AF_ZERO_COST !== "0" && process.env.AF_ALLOW_PAID_LLM !== "1";

/** Hardcoded free ($0/$0) models observed on ai-gateway.vercel.sh catalog */
export const VERCEL_FREE_MODELS = [
  process.env.AF_VERCEL_FREE_MODEL,
  "inclusionai/ling-3.0-flash-free",
  "poolside/laguna-s-2.1-free",
  "zai/glm-4.6v-flash",
].filter(Boolean);

export function zeroCostMode() {
  return ZERO;
}

export function gatewayKey() {
  return (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_GATEWAY_API_KEY ||
    process.env.AF_AI_GATEWAY_API_KEY ||
    ""
  );
}

export async function freeComplete(prompt, opts = {}) {
  const maxTokens = opts.maxTokens || 1200;
  const system =
    opts.system ||
    "You write practical SEO/AI-productivity content. No invented statistics. Short paragraphs. Include a direct-answer first sentence.";

  const force = (process.env.AF_LLM_PROVIDER || "").toLowerCase();
  // Prefer cloud free paths on Vercel/GHA (no ollama)
  const defaultOrder = process.env.VERCEL
    ? ["vercel", "gemini", "ollama", "opencode", "none"]
    : ["ollama", "gemini", "vercel", "opencode", "none"];
  const order =
    force && force !== "auto" ? [force] : defaultOrder;

  const errors = [];
  for (const p of order) {
    try {
      if (p === "ollama") {
        const text = await viaOllama(prompt, system, maxTokens);
        if (text) return { provider: "ollama", text, costUsd: 0 };
      } else if (p === "gemini") {
        const text = await viaGemini(prompt, system, maxTokens);
        if (text) return { provider: "gemini", text, costUsd: 0 };
      } else if (p === "vercel" || p === "gateway" || p === "ai-gateway") {
        const r = await viaVercelGateway(prompt, system, maxTokens);
        if (r?.text) return { provider: "vercel-gateway", model: r.model, text: r.text, costUsd: 0 };
        if (r?.error) errors.push(`vercel: ${r.error}`);
      } else if (p === "opencode") {
        const text = await viaOpencode(prompt, system);
        if (text) return { provider: "opencode", text, costUsd: 0 };
      } else if (p === "none") {
        return { provider: "none", text: null, costUsd: 0, errors };
      }
    } catch (e) {
      errors.push(`${p}: ${e.message || e}`);
    }
  }
  return { provider: "none", text: null, costUsd: 0, errors };
}

/**
 * Vercel AI Gateway — FREE models only when zero-cost.
 * API: OpenAI-compatible https://ai-gateway.vercel.sh/v1/chat/completions
 */
export async function viaVercelGateway(prompt, system, maxTokens) {
  const key = gatewayKey();
  if (!key) return { error: "AI_GATEWAY_API_KEY not set" };

  // Discover free models (prefer live $0 pricing, fallback to allowlist)
  let models = [...VERCEL_FREE_MODELS];
  try {
    const mr = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (mr.ok) {
      const data = await mr.json();
      const free = (data.data || [])
        .filter((m) => {
          const p = m.pricing || {};
          const zin = Number(p.input) === 0;
          const zout = Number(p.output) === 0;
          const idFree = /free/i.test(m.id || "") || /free/i.test(m.name || "");
          return (zin && zout) || idFree;
        })
        .map((m) => m.id);
      if (free.length) {
        // Prefer allowlist order, then any other free
        const ordered = [
          ...VERCEL_FREE_MODELS.filter((id) => free.includes(id)),
          ...free.filter((id) => !VERCEL_FREE_MODELS.includes(id)),
        ];
        models = ordered;
      }
    }
  } catch {
    /* use allowlist */
  }

  if (ZERO) {
    // Absolute guard: never call non-free model ids if we can detect paid
    models = models.filter(
      (id) =>
        /free/i.test(id) ||
        id === "zai/glm-4.6v-flash" ||
        VERCEL_FREE_MODELS.includes(id)
    );
  }

  let lastErr = "no free models tried";
  for (const model of models) {
    try {
      const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.6,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        lastErr = data.error?.message || data.message || res.statusText;
        // card required / paid only — stop trying paid paths
        if (/credit card|purchase|paid tier|do not have access/i.test(lastErr)) {
          return { error: lastErr };
        }
        continue;
      }
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return { model, text };
    } catch (e) {
      lastErr = e.message;
    }
  }
  return { error: lastErr };
}

async function viaOllama(prompt, system, maxTokens) {
  let model = process.env.AF_OLLAMA_MODEL || "";
  if (!model) {
    try {
      const list = spawnSync("ollama", ["list"], { encoding: "utf8", timeout: 5000 });
      if (list.status !== 0) return null;
      const lines = (list.stdout || "")
        .split("\n")
        .slice(1)
        .map((l) => l.split(/\s+/)[0])
        .filter(Boolean);
      model =
        lines.find((n) => /qwen2\.5:14b/i.test(n)) ||
        lines.find((n) => /qwen2\.5-coder/i.test(n)) ||
        lines.find((n) => /qwen/i.test(n)) ||
        lines.find((n) => /llama/i.test(n)) ||
        lines[0];
      if (!model) return null;
    } catch {
      return null;
    }
  }
  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { num_predict: maxTokens },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.message?.content || data.response || "").trim() || null;
}

async function viaGemini(prompt, system, maxTokens) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return null;
  const models = [
    process.env.AF_GEMINI_MODEL,
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-lite-latest",
  ].filter(Boolean);

  let lastErr;
  for (const m of [...new Set(models)]) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n---\n\n${prompt}` }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        lastErr = data.error?.message || res.statusText;
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim();
      if (text) return text;
    } catch (e) {
      lastErr = e.message;
    }
  }
  if (lastErr) throw new Error(lastErr);
  return null;
}

async function viaOpencode(prompt, system) {
  try {
    const r = spawnSync(
      "opencode",
      ["run", "--", `${system}\n\n${prompt}`.slice(0, 4000)],
      { encoding: "utf8", timeout: 120000, env: { ...process.env } }
    );
    if (r.status === 0 && r.stdout && r.stdout.trim().length > 80) {
      return r.stdout.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

// CLI
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("free-llm.mjs") ||
    fileURLToPath(import.meta.url) === process.argv[1]);
if (isMain) {
  const prompt =
    process.argv.slice(2).join(" ") ||
    "Say hello in one sentence about free SEO agents.";
  const r = await freeComplete(prompt, { maxTokens: 100 });
  console.log(
    JSON.stringify(
      {
        zeroCost: ZERO,
        gatewayKeySet: Boolean(gatewayKey()),
        freeModels: VERCEL_FREE_MODELS,
        ...r,
        textPreview: (r.text || "").slice(0, 200),
      },
      null,
      2
    )
  );
}
