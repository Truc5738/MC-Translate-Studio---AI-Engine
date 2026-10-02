/* Browser AI translation: runs in the browser with Transformers.js + ONNX.
   No Gemini/Groq API key and no file upload to the backend. The first run downloads
   the selected model and the browser cache can be reused on later runs. */

const MCTS_TRANSFORMERS_VERSION = "4.3.0";
const MCTS_MODEL_NLLB = "Xenova/nllb-200-distilled-600M";
const MCTS_MODEL_EN_VI = "Xenova/opus-mt-en-vi";
const MCTS_MODEL_VI_EN = "Xenova/opus-mt-vi-en";
const JSZIP_CDN = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
const TRANSFORMERS_CDN =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@" + MCTS_TRANSFORMERS_VERSION;

const MCTS_LANGS = {
  English: "eng_Latn",
  Vietnamese: "vie_Latn",
  Chinese: "zho_Hans",
  Japanese: "jpn_Jpan",
  Korean: "kor_Hang",
  Thai: "tha_Thai",
  Spanish: "spa_Latn",
  French: "fra_Latn",
  German: "deu_Latn",
  Indonesian: "ind_Latn",
  Portuguese: "por_Latn",
  Russian: "rus_Cyrl",
  Ukrainian: "ukr_Cyrl",
  Polish: "pol_Latn",
  Dutch: "nld_Latn",
  Turkish: "tur_Latn",
  Italian: "ita_Latn",
  Arabic: "arb_Arab",
  Hindi: "hin_Deva",
  Bengali: "ben_Beng",
  Malay: "zsm_Latn",
  Filipino: "tgl_Latn",
  Hebrew: "heb_Hebr",
  Persian: "pes_Arab",
  Greek: "ell_Grek",
  Czech: "ces_Latn",
  Swedish: "swe_Latn",
  Danish: "dan_Latn",
  Finnish: "fin_Latn",
  Norwegian: "nob_Latn",
  Romanian: "ron_Latn"
};

let transformersPromise = null;
let jszipPromise = null;
const pipelineCache = new Map();

function loadTransformers() {
  if (!transformersPromise) {
    transformersPromise = import(TRANSFORMERS_CDN).then(mod => {
      if (mod.env) mod.env.useBrowserCache = true;
      return mod;
    });
  }
  return transformersPromise;
}

function loadJSZip() {
  if (!jszipPromise) jszipPromise = import(JSZIP_CDN).then(mod => mod.default || mod);
  return jszipPromise;
}

function modelKey(source, target) {
  if (source === "English" && target === "Vietnamese") return "opus-en-vi";
  if (source === "Vietnamese" && target === "English") return "opus-vi-en";
  return "nllb";
}

function chooseDevice() {
  return typeof navigator !== "undefined" && navigator.gpu ? "webgpu" : "wasm";
}

async function getPipeline(source, target, onProgress) {
  const key = modelKey(source, target);
  if (pipelineCache.has(key)) return pipelineCache.get(key);

  const promise = (async () => {
    const { pipeline } = await loadTransformers();
    const device = chooseDevice();
    const model =
      key === "opus-en-vi" ? MCTS_MODEL_EN_VI :
      key === "opus-vi-en" ? MCTS_MODEL_VI_EN :
      MCTS_MODEL_NLLB;

    const report = data => {
      if (!onProgress) return;
      const value = typeof data?.progress === "number"
        ? Math.max(0, Math.min(100, data.progress))
        : null;
      onProgress({
        phase: "model",
        progress: value,
        label: data?.file ? String(data.file).split("/").pop() : "model",
        device
      });
    };

    try {
      return await pipeline("translation", model, {
        device,
        dtype: device === "webgpu" ? "q4f16" : "q8",
        progress_callback: report
      });
    } catch (firstError) {
      if (device !== "webgpu") throw firstError;
      onProgress?.({
        phase: "model",
        progress: null,
        label: "WebGPU không khả dụng, chuyển sang WASM"
      });
      return await pipeline("translation", model, {
        device: "wasm",
        dtype: "q8",
        progress_callback: report
      });
    }
  })();

  pipelineCache.set(key, promise);
  try {
    return await promise;
  } catch (error) {
    pipelineCache.delete(key);
    throw error;
  }
}

const PROTECTED_PATTERNS = [
  /https?:\/\/[^\s"'<>]+/gi,
  /(?:minecraft|[a-z0-9_.-]+):[a-z0-9_./-]+/gi,
  /(?:@[a-z]+|\$[0-9]+|%[^%]+%|\{[^}]+\}|<[^>]+>)/g,
  /§[0-9a-fk-or]/gi,
  /&[0-9a-fk-or]/gi,
  /\\[nrt"'\\]/g,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
];

function maskProtected(text) {
  const tokens = [];
  let out = String(text);
  for (const pattern of PROTECTED_PATTERNS) {
    out = out.replace(pattern, match => {
      const id = tokens.push(match) - 1;
      return "MCTSLOCK" + id + "TOKEN";
    });
  }
  return { text: out, tokens };
}

function restoreProtected(text, tokens) {
  return String(text).replace(/MCTSLOCK(\d+)TOKEN/g, (full, index) =>
    tokens[Number(index)] ?? full
  );
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^()|[\]\\]/g, "\\$&");
}

function glossaryReplace(text, glossary) {
  let out = String(text);
  const entries = Object.entries(glossary || {})
    .filter(([from, to]) => String(from).trim() && String(to).trim())
    .sort((a, b) => String(b[0]).length - String(a[0]).length);

  for (const [from, to] of entries) {
    const masked = maskProtected(out);
    out = masked.text.replace(
      new RegExp(escapeRegex(String(from)), "gi"),
      String(to)
    );
    out = restoreProtected(out, masked.tokens);
  }
  return out;
}

function shouldKeepString(value) {
  const text = String(value).trim();
  if (!text) return true;
  if (!/[A-Za-zÀ-ỹ\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text)) return true;
  if (/^(?:https?:\/\/|[a-z0-9_.-]+:[a-z0-9_./-]+$)/i.test(text)) return true;
  return false;
}

function splitLongText(text, maxChars = 700) {
  const source = String(text);
  if (source.length <= maxChars) return [source];

  const chunks = [];
  let current = "";
  for (const part of source.split(/(?<=[.!?。！？])\s+|\n+/)) {
    if (!part) continue;
    const candidate = current ? current + " " + part : part;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [source];
}

function normalizeTranslationResult(result) {
  if (Array.isArray(result)) {
    return result.map(item => typeof item === "string"
      ? item
      : item?.translation_text ?? "").join("\n");
  }
  return typeof result === "string" ? result : String(result?.translation_text ?? "");
}

async function translateNatural(text, source, target, pipe) {
  const original = String(text);
  if (shouldKeepString(original)) return original;

  const glossary = window.__MCTS_BROWSER_GLOSSARY || {};
  const protectedText = maskProtected(original);
  let working = protectedText.text;
  const glossaryTargets = [];

  const entries = Object.entries(glossary)
    .filter(([from, to]) => String(from).trim() && String(to).trim())
    .sort((a, b) => String(b[0]).length - String(a[0]).length);

  for (const [from, to] of entries) {
    const id = glossaryTargets.push(String(to)) - 1;
    working = working.replace(
      new RegExp(escapeRegex(String(from)), "gi"),
      "MCTSGLOSS" + id + "TOKEN"
    );
  }

  const pieces = working.split(/(MCTSLOCK\d+TOKEN|MCTSGLOSS\d+TOKEN)/g);
  let output = "";

  for (const piece of pieces) {
    if (!piece) continue;

    const glossaryMatch = piece.match(/^MCTSGLOSS(\d+)TOKEN$/);
    if (glossaryMatch) {
      output += glossaryTargets[Number(glossaryMatch[1])] ?? piece;
      continue;
    }

    if (/^MCTSLOCK\d+TOKEN$/.test(piece) || !piece.trim()) {
      output += piece;
      continue;
    }

    const chunks = splitLongText(piece);
    for (const chunk of chunks) {
      if (shouldKeepString(chunk)) {
        output += chunk;
        continue;
      }

      const args = {};
      if (modelKey(source, target) === "nllb") {
        args.src_lang = MCTS_LANGS[source];
        args.tgt_lang = MCTS_LANGS[target];
      }

      const result = await pipe(chunk, args);
      const translated = normalizeTranslationResult(result).trim();
      output += translated || chunk;
    }
  }

  return restoreProtected(output, protectedText.tokens);
}

function skipJsonKey(key) {
  return /^(id|ids|key|keys|name|namespace|identifier|icon|texture|path|url|uuid|command|commands|type|format|version|module|modules|dependencies|description_id)$/i.test(String(key))
    || (/^[a-z0-9_.:-]+$/.test(String(key)) && !/\s/.test(String(key)));
}

function extractJsonStrings(value, key = "", out = []) {
  if (typeof value === "string") {
    if (!skipJsonKey(key)) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractJsonStrings(item, key, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      extractJsonStrings(childValue, childKey, out);
    }
  }
  return out;
}

function applyJsonTranslations(value, key, map) {
  if (typeof value === "string") return skipJsonKey(key) ? value : (map.get(value) ?? value);
  if (Array.isArray(value)) return value.map(item => applyJsonTranslations(item, key, map));
  if (value && typeof value === "object") {
    const out = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = applyJsonTranslations(childValue, childKey, map);
    }
    return out;
  }
  return value;
}

function collectLineValues(text, mode, out) {
  const lines = String(text).split(/(\r?\n)/);
  for (const line of lines) {
    if (!line || /^\r?\n$/.test(line)) continue;

    if (["properties", "lang", "ini", "cfg"].includes(mode)) {
      if (/^\s*[#!]/.test(line) || !line.trim()) continue;
      const match = line.match(/^(\s*[^:=#]+?\s*)([:=])(\s*)(.*)$/);
      if (match) out.push(match[4]);
      else out.push(line);
    } else if (["yaml", "yml"].includes(mode)) {
      if (/^\s*#/.test(line) || !line.trim()) continue;
      const match = line.match(/^(\s*[^:#]+?:\s*)(['"]?)(.*?)(\2)\s*$/);
      if (match) out.push(match[3]);
    } else if (mode === "mcfunction") {
      const index = line.indexOf("#");
      if (index >= 0) out.push(line.slice(index));
    }
  }
}

function replaceLineValues(text, mode, map) {
  return String(text).split(/(\r?\n)/).map(line => {
    if (!line || /^\r?\n$/.test(line)) return line;

    if (["properties", "lang", "ini", "cfg"].includes(mode)) {
      if (/^\s*[#!]/.test(line) || !line.trim()) return line;
      const match = line.match(/^(\s*[^:=#]+?\s*)([:=])(\s*)(.*)$/);
      if (!match) return map.get(line) ?? line;
      return match[1] + match[2] + match[3] + (map.get(match[4]) ?? match[4]);
    }

    if (["yaml", "yml"].includes(mode)) {
      if (/^\s*#/.test(line) || !line.trim()) return line;
      const match = line.match(/^(\s*[^:#]+?:\s*)(['"]?)(.*?)(\2)\s*$/);
      if (!match) return line;
      return match[1] + match[2] + (map.get(match[3]) ?? match[3]) + match[4];
    }

    if (mode === "mcfunction") {
      const index = line.indexOf("#");
      if (index < 0) return line;
      const comment = line.slice(index);
      return line.slice(0, index) + (map.get(comment) ?? comment);
    }

    return line;
  }).join("");
}

function collectMarkup(text, out) {
  String(text).replace(/>([^<>]+)</g, (whole, inner) => {
    if (inner.trim()) out.push(inner);
    return whole;
  });
}

function replaceMarkup(text, map) {
  return String(text).replace(/>([^<>]+)</g, (whole, inner) =>
    ">" + (map.get(inner) ?? inner) + "<"
  );
}

function collectQuotedCode(text, out) {
  String(text).replace(/(["'])((?:\\.|(?!\1).)*)\1/g, (whole, quote, inner) => {
    if (!/^(?:https?:|minecraft:)/i.test(inner)) out.push(inner);
    return whole;
  });
}

function replaceQuotedCode(text, map) {
  return String(text).replace(/(["'])((?:\\.|(?!\1).)*)\1/g, (whole, quote, inner) => {
    if (/^(?:https?:|minecraft:)/i.test(inner)) return whole;
    return quote + (map.get(inner) ?? inner) + quote;
  });
}

function collectGeneric(text, out) {
  for (const line of String(text).split(/\r?\n/)) {
    if (line.trim()) out.push(line);
  }
}

function modeForPath(path) {
  const ext = String(path).toLowerCase().split(".").pop() || "";
  if (ext === "json") return "json";
  if (["properties", "lang", "ini", "cfg"].includes(ext)) return ext;
  if (["yaml", "yml"].includes(ext)) return ext;
  if (ext === "mcfunction") return "mcfunction";
  if (["xml", "html", "htm"].includes(ext)) return "markup";
  if (["js", "ts", "java"].includes(ext)) return "code";
  return "generic";
}

async function translateTextMap(values, source, target, pipe, progress) {
  const unique = [...new Set(values.map(String))].filter(v => v.trim());
  const map = new Map();
  let done = 0;

  for (const value of unique) {
    try {
      map.set(value, await translateNatural(value, source, target, pipe));
    } catch {
      map.set(value, value);
    }
    done++;
    progress?.(done, unique.length);
  }
  return map;
}

async function translateFile(entry, source, target, pipe, glossary, onTextProgress) {
  window.__MCTS_BROWSER_GLOSSARY = glossary || {};
  const path = entry.name;
  const data = await entry.async("string");
  const mode = modeForPath(path);

  if (mode === "json") {
    try {
      const parsed = JSON.parse(data);
      const values = extractJsonStrings(parsed);
      const map = await translateTextMap(values, source, target, pipe, onTextProgress);
      return JSON.stringify(applyJsonTranslations(parsed, "", map), null, 2);
    } catch {
      const map = await translateTextMap([data], source, target, pipe, onTextProgress);
      return map.get(data) ?? data;
    }
  }

  const values = [];
  if (["properties", "lang", "ini", "cfg", "yaml", "yml", "mcfunction"].includes(mode)) {
    collectLineValues(data, mode, values);
  } else if (mode === "markup") {
    collectMarkup(data, values);
  } else if (mode === "code") {
    collectQuotedCode(data, values);
  } else {
    collectGeneric(data, values);
  }

  const map = await translateTextMap(values, source, target, pipe, onTextProgress);

  if (["properties", "lang", "ini", "cfg", "yaml", "yml", "mcfunction"].includes(mode)) {
    return replaceLineValues(data, mode, map);
  }
  if (mode === "markup") return replaceMarkup(data, map);
  if (mode === "code") return replaceQuotedCode(data, map);
  return String(data).split(/(\r?\n)/).map(part => /^\r?\n$/.test(part) ? part : (map.get(part) ?? part)).join("");
}

async function translateZipInBrowser(file, options = {}) {
  const source = String(options.source || "English");
  const target = String(options.target || "Vietnamese");

  if (!MCTS_LANGS[source] || !MCTS_LANGS[target]) {
    throw new Error("Ngôn ngữ nguồn hoặc đích chưa được hỗ trợ.");
  }
  if (source === target) {
    throw new Error("Ngôn ngữ nguồn và đích phải khác nhau.");
  }

  const zipLib = await loadJSZip();
  const zip = await zipLib.loadAsync(file);
  const out = new zipLib();
  const entries = Object.keys(zip.files);
  const textExt = /\.(json|jsonc|lang|properties|yml|yaml|txt|mcfunction|ini|cfg|toml|xml|html|htm|js|ts|java|md)$/i;
  const skip = /(^|\/)(pack_icon\.png|manifest\.json\.bak|.*\.png|.*\.jpg|.*\.jpeg|.*\.webp|.*\.ogg|.*\.mp3|.*\.wav|.*\.mp4|.*\.mcstructure|.*\.bin)$/i;

  options.onProgress?.({ phase: "model", progress: 0, label: "Đang chuẩn bị Browser AI..." });
  const pipe = await getPipeline(source, target, options.onProgress);

  const candidates = entries.filter(path => {
    const entry = zip.files[path];
    return !entry.dir && textExt.test(path) && !skip.test(path);
  });

  let translated = 0;
  let finished = 0;

  for (const path of entries) {
    const entry = zip.files[path];
    if (entry.dir) {
      out.folder(path);
      continue;
    }

    const blob = await entry.async("blob");
    if (!textExt.test(path) || skip.test(path) || blob.size >= 500_000) {
      out.file(path, blob);
      continue;
    }

    try {
      const result = await translateFile(
        entry,
        source,
        target,
        pipe,
        options.glossary || {},
        (done, total) => options.onProgress?.({
          phase: "text",
          path,
          current: done,
          total: Math.max(total, 1)
        })
      );
      out.file(path, result);
      translated++;
    } catch {
      out.file(path, blob);
    }

    finished++;
    options.onProgress?.({
      phase: "files",
      current: finished,
      total: Math.max(candidates.length, 1),
      label: path
    });
  }

  options.onProgress?.({ phase: "zip", progress: 0, label: "Đang đóng gói file..." });
  const blob = await out.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    streamFiles: true
  });

  return {
    blob,
    translated,
    entries,
    model:
      modelKey(source, target) === "opus-en-vi" ? MCTS_MODEL_EN_VI :
      modelKey(source, target) === "opus-vi-en" ? MCTS_MODEL_VI_EN :
      MCTS_MODEL_NLLB,
    device: chooseDevice()
  };
}

window.MC_TRANSLATE_BROWSER_AI = {
  translateZipInBrowser,
  models: {
    nllb: MCTS_MODEL_NLLB,
    enVi: MCTS_MODEL_EN_VI,
    viEn: MCTS_MODEL_VI_EN
  },
  languages: MCTS_LANGS
};
