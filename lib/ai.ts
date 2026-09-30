import { getAIKeys } from "./keys";
import { markFailure, markSuccess, pickKeys } from "./ai-pool";
import { looksCorrupt } from "./validate";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function minecraftPrompt(source: string, target: string, filePath: string) {
  return `You are a Minecraft localization and repair engine.
Translate human-facing text from the source language to ${target}.
File: ${filePath}

STRICT RULES:
- Return ONLY the translated/repaired content. No Markdown fences or commentary.
- Preserve JSON/YAML/properties syntax exactly.
- Never translate identifiers, namespaces, registry IDs, resource paths, URLs, commands, selectors, UUIDs, version numbers, API/class/method names.
- Never change placeholders such as %player%, {count}, <player>, $1 or Minecraft formatting codes such as §a.
- For .mcfunction files, never alter commands; only translate comments beginning with #.
- Preserve whitespace and line structure as much as possible.
- Translate only player-facing natural language.
- If input is already in target language, keep it unchanged.

CONTENT:
${source}`;
}

async function fetchJson(url: string, init: RequestInit) {
  const timeout = Number(process.env.AI_REQUEST_TIMEOUT_MS || 60000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, timeout));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(key: string, prompt: string) {
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const r = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    }
  );
  const d = await r.json();
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${JSON.stringify(d).slice(0, 500)}`);
  return d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
}

async function callGroq(key: string, prompt: string) {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const r = await fetchJson("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a precise Minecraft localization engine." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Groq ${r.status}: ${JSON.stringify(d).slice(0, 500)}`);
  return d?.choices?.[0]?.message?.content || "";
}

export async function generateTranslation(source: string, target: string, filePath: string) {
  const keys = await pickKeys();
  if (!keys.length) throw new Error("No healthy AI API key is available. Check the Admin API pool.");

  const prompt = minecraftPrompt(source, target, filePath);
  let lastError = "Unknown AI error";

  for (const k of keys) {
    try {
      const out = k.provider === "gemini"
        ? await callGemini(k.key, prompt)
        : await callGroq(k.key, prompt);

      if (!out.trim()) throw new Error("Empty model response");
      if (looksCorrupt(source, out)) {
        throw new Error("Safety validation failed: placeholders or formatting codes changed.");
      }

      markSuccess(k.id);
      return out;
    } catch (e: any) {
      lastError = e?.name === "AbortError"
        ? "AI request timed out"
        : e?.message || String(e);
      markFailure(k.id, lastError);
      await sleep(250);
    }
  }

  throw new Error(lastError);
}
