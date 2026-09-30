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

function scanText(path: string, text: string, out: Diagnostic[]) {
  if (/\b(Error|Exception|InvalidPluginException|NoClassDefFoundError|ClassNotFoundException|Could not load plugin)\b/i.test(text)) {
    out.push({severity:"error",path,message:"Phát hiện mẫu lỗi runtime/plugin.",suggestion:"Kiểm tra lỗi đầu tiên trong stack trace và dependency liên quan."});
  }
  if (/manifest\.json$/i.test(path)) {
    try {
      const value = JSON.parse(text);
      if (!value?.header) out.push({severity:"error",path,message:"manifest.json thiếu header.",suggestion:"Kiểm tra header.name, header.description, header.uuid và header.version."});
      if (!Array.isArray(value?.modules) || value.modules.length === 0) out.push({severity:"error",path,message:"manifest.json thiếu modules hợp lệ.",suggestion:"Thêm module phù hợp với loại pack."});
    } catch {
      out.push({severity:"error",path,message:"JSON không hợp lệ.",suggestion:"Kiểm tra dấu phẩy, dấu ngoặc và chuỗi JSON."});
    }
  }
  if (/plugin\.yml$/i.test(path) && !/^\s*main\s*:/m.test(text)) {
    out.push({severity:"error",path,message:"plugin.yml không thấy trường main.",suggestion:"Đảm bảo main trỏ tới class plugin thực tế."});
  }
  if (/\.mcfunction$/i.test(path) && /^\s*\/+/m.test(text)) {
    out.push({severity:"warning",path,message:"Phát hiện command bắt đầu bằng dấu /.",suggestion:"Bedrock mcfunction thường dùng command không có dấu / ở đầu."});
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "repair-analyze", 10, 60_000);
  const blocked = rateLimitResponse(limited);
  if (blocked) return blocked;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const log = String(form.get("log") || "");
    const diagnostics: Diagnostic[] = [];

    if (log.trim()) scanText("server-log.txt", log.slice(0, 500_000), diagnostics);

    if (file instanceof File) {
      const max = Number(process.env.MAX_FILE_MB || 50) * 1024 * 1024;
      if (file.size > max) return NextResponse.json({error:"File vượt giới hạn."},{status:413});
      const bytes = Buffer.from(await file.arrayBuffer());
      const zip = await JSZip.loadAsync(bytes);
      for (const path of Object.keys(zip.files)) {
        const entry = zip.files[path];
        if (entry.dir) continue;
        if (/\.(json|jsonc|yml|yaml|properties|lang|mcfunction|txt|cfg|ini)$/i.test(path)) {
          const data = await entry.async("string");
          if (data.length <= 500_000) scanText(path,data,diagnostics);
        }
      }
    }

    return NextResponse.json({ok:true,diagnostics,summary:{
      errors:diagnostics.filter(x=>x.severity==="error").length,
      warnings:diagnostics.filter(x=>x.severity==="warning").length,
      info:diagnostics.filter(x=>x.severity==="info").length
    }});
  } catch (e: any) {
    return NextResponse.json({error:e?.message || "Không thể phân tích file."},{status:400});
  }
}
