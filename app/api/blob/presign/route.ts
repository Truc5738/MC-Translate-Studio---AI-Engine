import { NextRequest } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import crypto from "node:crypto";
import { corsJson } from "@/lib/cors";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
const ALLOWED = /\.(mcaddon|mcpack|zip|jar)$/i;

export async function OPTIONS(req: NextRequest) {
  return corsJson(req, { ok: true });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "blob-presign", 10, 60_000);
  const blocked = rateLimitResponse(req, limited);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const fileName = String(body?.fileName || "pack.zip").replace(/[\r\n"\\/]/g, "_").slice(0, 240);
    const size = Number(body?.size || 0);
    const contentType = String(body?.contentType || "application/zip").slice(0, 120);
    const max = Number(process.env.MAX_FILE_MB || 50) * 1024 * 1024;
    if (!ALLOWED.test(fileName)) return corsJson(req, { ok: false, error: "Unsupported file type" }, { status: 400 });
    if (!Number.isFinite(size) || size <= 0 || size > max) return corsJson(req, { ok: false, error: "File exceeds the configured size limit" }, { status: 413 });

    const pathname = "uploads/" + crypto.randomUUID() + "-" + fileName;
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const token = await issueSignedToken({
      pathname,
      operations: ["put"],
      validUntil: expiresAt,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: max
    });
    const { presignedUrl } = await presignUrl(token, {
      pathname,
      operation: "put",
      validUntil: expiresAt,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: max,
      access: "public",
      allowOverwrite: false
    });
    return corsJson(req, { ok: true, uploadUrl: presignedUrl, fileUrl: presignedUrl.split("?")[0], pathname, expiresAt });
  } catch (error: any) {
    return corsJson(req, { ok: false, error: error?.message || "Unable to create upload URL" }, { status: 500 });
  }
}
