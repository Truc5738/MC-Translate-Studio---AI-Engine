import JSZip from "jszip";

// JSONC and TOML need syntax-aware parsers; do not pass them through plain-text translation.
const TEXT_EXT = /\.(json|lang|properties|yml|yaml|txt|mcfunction|ini|cfg|xml|js|ts|java|md)$/i;
const SKIP = /(^|\/)(pack_icon\.png|manifest\.json\.bak|.*\.png|.*\.jpg|.*\.jpeg|.*\.webp|.*\.ogg|.*\.mp3|.*\.wav|.*\.mp4|.*\.mcstructure|.*\.bin)$/i;
const NESTED_ARCHIVE = /\.(mcaddon|mcpack|zip)$/i;
const MAX_NESTED_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_NESTED_DEPTH = 3;

export async function translateZip(
  input: Buffer,
  target: string,
  translate: (s: string, target: string, path: string) => Promise<string>,
  depth = 0
) {
  const zip = await JSZip.loadAsync(input);
  const out = new JSZip();
  const entries = Object.keys(zip.files);
  let translated = 0;

  for (const path of entries) {
    const file = zip.files[path];
    if (file.dir) {
      out.folder(path);
      continue;
    }

    const data = await file.async("nodebuffer");

    // MCAddon files commonly contain nested .mcpack archives. Translate those
    // recursively instead of silently copying the packs without touching them.
    if (
      NESTED_ARCHIVE.test(path) &&
      depth < MAX_NESTED_DEPTH &&
      data.length <= MAX_NESTED_ARCHIVE_BYTES
    ) {
      try {
        const nested = await translateZip(data, target, translate, depth + 1);
        out.file(path, nested.buffer);
        translated += nested.translated;
        continue;
      } catch {
        // Keep an unrecognized or malformed nested archive unchanged.
        out.file(path, data);
        continue;
      }
    }

    if (TEXT_EXT.test(path) && !SKIP.test(path) && data.length < 500_000) {
      try {
        const source = data.toString("utf8");
        const result = await translate(source, target, path);
        out.file(path, result);
        translated++;
      } catch {
        out.file(path, data);
      }
    } else {
      out.file(path, data);
    }
  }

  return {
    buffer: await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
    entries,
    translated
  };
}
