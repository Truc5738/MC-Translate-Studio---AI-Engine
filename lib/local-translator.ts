const DEFAULT_EN_VI: Record<string, string> = {
  "loading": "đang tải",
  "settings": "cài đặt",
  "options": "tùy chọn",
  "language": "ngôn ngữ",
  "play": "phát",
  "pause": "tạm dừng",
  "resume": "tiếp tục",
  "stop": "dừng",
  "start": "bắt đầu",
  "close": "đóng",
  "cancel": "hủy",
  "confirm": "xác nhận",
  "save": "lưu",
  "delete": "xóa",
  "remove": "xóa",
  "back": "quay lại",
  "next": "tiếp theo",
  "previous": "trước",
  "open": "mở",
  "edit": "chỉnh sửa",
  "search": "tìm kiếm",
  "download": "tải xuống",
  "upload": "tải lên",
  "enabled": "đã bật",
  "disabled": "đã tắt",
  "enable": "bật",
  "disable": "tắt",
  "online": "trực tuyến",
  "offline": "ngoại tuyến",
  "welcome": "chào mừng",
  "hello": "xin chào",
  "thank you": "cảm ơn",
  "please": "vui lòng",
  "try again": "thử lại",
  "are you sure": "bạn có chắc không",
  "version": "phiên bản",
  "update": "cập nhật",
  "connect": "kết nối",
  "disconnect": "ngắt kết nối",
  "connected": "đã kết nối",
  "disconnected": "đã ngắt kết nối",
  "server": "máy chủ",
  "player": "người chơi",
  "players": "người chơi",
  "world": "thế giới",
  "item": "vật phẩm",
  "items": "vật phẩm",
  "block": "khối",
  "blocks": "khối",
  "entity": "thực thể",
  "entities": "thực thể",
  "inventory": "túi đồ",
  "crafting": "chế tạo",
  "recipe": "công thức",
  "recipes": "công thức",
  "health": "máu",
  "damage": "sát thương",
  "armor": "giáp",
  "level": "cấp",
  "experience": "kinh nghiệm",
  "command": "lệnh",
  "commands": "các lệnh",
  "permission": "quyền",
  "permissions": "quyền",
  "error": "lỗi",
  "warning": "cảnh báo",
  "success": "thành công",
  "failed": "thất bại",
  "not found": "không tìm thấy",
  "unknown": "không xác định",
  "time": "thời gian",
  "date": "ngày",
  "name": "tên",
  "description": "mô tả",
  "title": "tiêu đề",
  "message": "tin nhắn",
  "join": "tham gia",
  "leave": "rời đi",
  "spawn": "điểm hồi sinh",
  "teleport": "dịch chuyển",
  "difficulty": "độ khó",
  "easy": "dễ",
  "normal": "bình thường",
  "hard": "khó",
  "peaceful": "yên bình"
};

const PROTECTED = [
  /https?:\/\/[^\s"'<>]+/gi,
  /(?:minecraft|[a-z0-9_.-]+):[a-z0-9_./-]+/gi,
  /(?:@[a-z]+|\$[0-9]+|%[^%]+%|\{[^}]+\}|<[^>]+>)/g,
  /§[0-9a-fk-or]/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
];

function isVietnamese(target: string) {
  return /^(vietnamese|vi|vi-vn|tiếng việt)$/i.test(target.trim());
}

function maskProtected(text: string) {
  const values: string[] = [];
  let out = text;
  for (const pattern of PROTECTED) {
    out = out.replace(pattern, match => {
      const id = values.push(match) - 1;
      return "___MCTS_PROTECTED_" + id + "___";
    });
  }
  return { out, values };
}

function unmask(text: string, values: string[]) {
  return text.replace(/___MCTS_PROTECTED_(\d+)___/g, (_, index) => values[Number(index)] ?? _);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^()|[\]\\]/g, "\\$&");
}

function glossaryEntries(target: string, custom?: Record<string, string>) {
  const merged: Record<string, string> = isVietnamese(target) ? { ...DEFAULT_EN_VI } : {};
  for (const [from, to] of Object.entries(custom || {})) {
    if (from.trim() && to.trim() && from !== to) merged[from] = to;
  }
  return Object.entries(merged).sort((a, b) => b[0].length - a[0].length);
}

function replaceGlossary(text: string, target: string, custom?: Record<string, string>) {
  const masked = maskProtected(text);
  let result = masked.out;
  for (const [from, to] of glossaryEntries(target, custom)) {
    result = result.replace(new RegExp(escapeRegex(from), "gi"), to);
  }
  return unmask(result, masked.values);
}

function skipJsonKey(key: string) {
  return /^(id|ids|key|keys|name|namespace|identifier|icon|texture|path|url|uuid|command|commands|type|format|version|module|modules|dependencies|description_id)$/i.test(key)
    || (/^[a-z0-9_.:-]+$/.test(key) && !/\s/.test(key));
}

function translateJson(value: unknown, target: string, custom?: Record<string, string>, key = ""): unknown {
  if (typeof value === "string") {
    return skipJsonKey(key) ? value : replaceGlossary(value, target, custom);
  }
  if (Array.isArray(value)) return value.map(item => translateJson(item, target, custom, key));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = translateJson(childValue, target, custom, childKey);
    }
    return out;
  }
  return value;
}

function translateProperties(text: string, target: string, custom?: Record<string, string>) {
  return text.split(/(\r?\n)/).map(line => {
    if (/^\s*[#!]/.test(line) || !line.trim()) return line;
    const match = line.match(/^(\s*[^:=#]+?\s*)([:=])(\s*)(.*)$/);
    return match
      ? match[1] + match[2] + match[3] + replaceGlossary(match[4], target, custom)
      : replaceGlossary(line, target, custom);
  }).join("");
}

function translateYaml(text: string, target: string, custom?: Record<string, string>) {
  return text.split(/(\r?\n)/).map(line => {
    if (/^\s*#/.test(line) || !line.trim()) return line;
    const match = line.match(/^(\s*[^:#]+?:\s*)(['"]?)(.*?)(\2)\s*$/);
    return match
      ? match[1] + match[2] + replaceGlossary(match[3], target, custom) + match[4]
      : line;
  }).join("");
}

function translateMcfunction(text: string, target: string, custom?: Record<string, string>) {
  return text.split(/(\r?\n)/).map(line => {
    const index = line.indexOf("#");
    return index < 0
      ? line
      : line.slice(0, index) + replaceGlossary(line.slice(index), target, custom);
  }).join("");
}

function translateMarkup(text: string, target: string, custom?: Record<string, string>) {
  return text.replace(/>([^<>]+)</g, (_, inner) => ">" + replaceGlossary(inner, target, custom) + "<");
}

function translateQuotedCode(text: string, target: string, custom?: Record<string, string>) {
  return text.replace(/(["'\`])((?:\\.|(?!\1).)*)\1/g, (whole, quote, inner) => {
    if (/\b(?:https?|minecraft)[:/]/i.test(inner)) return whole;
    return quote + replaceGlossary(inner, target, custom) + quote;
  });
}

export function translateLocal(
  source: string,
  target: string,
  filePath: string,
  customGlossary?: Record<string, string>
) {
  const ext = filePath.toLowerCase().split(".").pop() || "";

  try {
    if (ext === "json") {
      const parsed = JSON.parse(source);
      return JSON.stringify(translateJson(parsed, target, customGlossary), null, 2);
    }
  } catch {
    return replaceGlossary(source, target, customGlossary);
  }

  if (ext === "properties" || ext === "lang" || ext === "ini" || ext === "cfg") {
    return translateProperties(source, target, customGlossary);
  }
  if (ext === "yml" || ext === "yaml") {
    return translateYaml(source, target, customGlossary);
  }
  if (ext === "mcfunction") {
    return translateMcfunction(source, target, customGlossary);
  }
  if (ext === "xml" || ext === "html" || ext === "htm") {
    return translateMarkup(source, target, customGlossary);
  }
  if (ext === "js" || ext === "ts" || ext === "java") {
    return translateQuotedCode(source, target, customGlossary);
  }

  return replaceGlossary(source, target, customGlossary);
}

export function parseGlossaryText(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of value.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const from = line.slice(0, separator).trim();
    const to = line.slice(separator + 1).trim();
    if (from && to) out[from] = to;
  }
  return out;
}
