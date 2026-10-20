import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type Diagnostic = {
  severity: "error" | "warning" | "info";
  path: string;
  message: string;
  suggestion: string;
};

const TEXT_FILE = /\.(json|jsonc|yml|yaml|properties|lang|mcfunction|txt|cfg|ini)$/i;
const MAX_TEXT_CHARS = 500_000;
const MAX_ARCHIVE_ENTRIES = 2_000;

function scanText(path: string, text: string, out: Diagnostic[]) {
  if (/\b(Error|Exception|InvalidPluginException|NoClassDefFoundError|ClassNotFoundException|Could not load plugin)\b/i.test(text)) {
    out.push({ severity: "error", path, message: "Phát hiện mẫu lỗi runtime/plugin.", suggestion: "Kiểm tra lỗi đầu tiên trong stack trace và dependency liên quan." });
  }

  if (/\.json$/i.test(path)) {
    try {
      JSON.parse(text);
    } catch {
      out.push({ severity: "error", path, message: "JSON không hợp lệ.", suggestion: "Kiểm tra dấu phẩy, dấu ngoặc và chuỗi JSON." });
      return;
    }
  }

  if (/manifest\.json$/i.test(path)) {
    try {
      const value = JSON.parse(text);
      if (!value?.header) out.push({ severity: "error", path, message: "manifest.json thiếu header.", suggestion: "Kiểm tra header.name, header.description, header.uuid và header.version." });
      if (!Array.isArray(value?.modules) || value.modules.length === 0) out.push({ severity: "error", path, message: "manifest.json thiếu modules hợp lệ.", suggestion: "Thêm module phù hợp với loại pack." });
      if (value?.header && (!value.header.uuid || !Array.isArray(value.header.version) || value.header.version.length !== 3)) {
        out.push({ severity: "warning", path, message: "Header thiếu UUID hoặc version chưa đúng dạng 3 số.", suggestion: "Kiểm tra header.uuid và header.version, ví dụ [1, 0, 0]." });
      }
    } catch {
      // The generic JSON check above already reports this file.
    }
  }

  if (/plugin\.yml$/i.test(path) && !/^\s*main\s*:/m.test(text)) {
    out.push({ severity: "error", path, message: "plugin.yml không thấy trường main.", suggestion: "Đảm bảo main trỏ tới class plugin thực tế." });
  }

  if (/\.mcfunction$/i.test(path) && /^\s*\/+/m.test(text)) {
    out.push({ severity: "warning", path, message: "Phát hiện command bắt đầu bằng dấu /.", suggestion: "Bedrock mcfunction thường dùng command không có dấu / ở đầu." });
  }
}

function summary(diagnostics: Diagnostic[]) {
  return {
    errors: diagnostics.filter((item) => item.severity === "error").length,
    warnings: diagnostics.filter((item) => item.severity === "warning").length,
    info: diagnostics.filter((item) => item.severity === "info").length,
  };
}

export async function OPTIONS(_req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "repair-analyze", 10, 60_000);
  const blocked = rateLimitResponse(req, limited);
  if (blocked) return blocked;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const log = String(form.get("log") || "");
    const diagnostics: Diagnostic[] = [];

    if (log.trim()) scanText("server-log.txt", log.slice(0, MAX_TEXT_CHARS), diagnostics);

    if (file instanceof File && file.size > 0) {
      const maxMb = Number(process.env.MAX_FILE_MB || 50);
      const maxBytes = (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 50) * 1024 * 1024;
      if (file.size > maxBytes) {
        return NextResponse.json({ error: `File vượt giới hạn ${Math.round(maxBytes / (1024 * 1024))} MB.` }, { status: 413 });
      }

      const filename = file.name.toLowerCase();
      if (/\.(log|txt)$/i.test(filename)) {
        scanText(file.name, (await file.text()).slice(0, MAX_TEXT_CHARS), diagnostics);
      } else if (/\.(mcaddon|mcpack|zip|jar)$/i.test(filename)) {
        let zip: JSZip;
        try {
          zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: false });
        } catch {
          return NextResponse.json({ error: "Không đọc được gói nén. File có thể bị hỏng hoặc không đúng định dạng ZIP." }, { status: 400 });
        }

        const paths = Object.keys(zip.files);
        if (paths.length > MAX_ARCHIVE_ENTRIES) {
          return NextResponse.json({ error: `Gói có quá nhiều mục (tối đa ${MAX_ARCHIVE_ENTRIES}).` }, { status: 413 });
        }

        let scanned = 0;
        for (const path of paths) {
          const entry = zip.files[path];
          if (entry.dir || !TEXT_FILE.test(path)) continue;

          const uncompressedSize = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
          if (typeof uncompressedSize === "number" && uncompressedSize > MAX_TEXT_CHARS) {
            diagnostics.push({ severity: "warning", path, message: "Bỏ qua tệp văn bản quá lớn.", suggestion: "Kiểm tra tệp này riêng hoặc giảm kích thước xuống dưới 500 KB." });
            continue;
          }

          const data = await entry.async("string");
          if (data.length > MAX_TEXT_CHARS) {
            diagnostics.push({ severity: "warning", path, message: "Bỏ qua tệp văn bản quá lớn.", suggestion: "Kiểm tra tệp này riêng hoặc giảm kích thước xuống dưới 500 KB." });
            continue;
          }
          scanText(path, data, diagnostics);
          scanned++;
        }

        if (scanned === 0) {
          diagnostics.push({ severity: "info", path: file.name, message: "Không tìm thấy tệp văn bản thuộc nhóm có thể kiểm tra.", suggestion: "Đảm bảo gói chứa manifest.json, JSON, YAML, mcfunction hoặc tệp cấu hình." });
        }
      } else {
        return NextResponse.json({ error: "Định dạng chưa được hỗ trợ. Hãy dùng .mcaddon, .mcpack, .zip, .jar, .log hoặc .txt." }, { status: 415 });
      }
    } else if (!log.trim()) {
      return NextResponse.json({ error: "Hãy chọn file hoặc dán log lỗi trước khi phân tích." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, diagnostics, summary: summary(diagnostics) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể phân tích file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
