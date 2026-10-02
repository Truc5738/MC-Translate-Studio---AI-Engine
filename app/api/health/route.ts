import { NextRequest } from "next/server";
import postgres from "postgres";
import { getAIKeys } from "@/lib/keys";
import { corsJson } from "@/lib/cors";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return corsJson(req, { ok: true });
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "health", 30, 60_000);
  const blocked = rateLimitResponse(req, limited);
  if (blocked) return blocked;

  let database = "not-configured";
  if (process.env.POSTGRES_URL) {
    try {
      const sql = postgres(process.env.POSTGRES_URL, { max: 1, idle_timeout: 5, connect_timeout: 5 });
      await sql`SELECT 1`;
      await sql.end({ timeout: 2 });
      database = "ok";
    } catch {
      database = "error";
    }
  }

  let ai = { configured: false, total: 0, enabled: 0, providers: [] as string[] };
  try {
    const keys = await getAIKeys();
    ai = {
      configured: keys.length > 0,
      total: keys.length,
      enabled: keys.filter((key) => key.enabled && key.key).length,
      providers: [...new Set(keys.filter((key) => key.enabled && key.key).map((key) => key.provider))]
    };
  } catch {
    ai = { configured: false, total: 0, enabled: 0, providers: [] };
  }

  const ok = Boolean(process.env.POSTGRES_URL) && database === "ok" && ai.enabled > 0;

  return corsJson(req, {
    ok,
    service: "mc-translate-studio-ai-engine",
    runtime: process.env.VERCEL ? "vercel" : "node",
    environment: process.env.VERCEL_ENV || "unknown",
    database,
    blob: process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL ? "configured-or-oidc" : "not-configured",
    queue: process.env.VERCEL ? "vercel-queue-ready" : "requires-vercel",
    ai,
    timestamp: new Date().toISOString()
  }, { status: ok ? 200 : 503 });
}
