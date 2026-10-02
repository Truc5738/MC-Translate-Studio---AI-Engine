import { NextRequest } from "next/server";
import postgres from "postgres";
import { poolStatus } from "@/lib/ai-pool";
import { getAIKeys } from "@/lib/keys";
import { corsJson } from "@/lib/cors";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
const startedAt = Date.now();

export async function OPTIONS(req: NextRequest) {
  return corsJson(req, { ok: true });
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "health", 30, 60_000);
  const blocked = rateLimitResponse(req, limited);
  if (blocked) return blocked;

  const keys = await getAIKeys();
  const pool = poolStatus(keys);

  let database = "not-configured";
  if (process.env.POSTGRES_URL) {
    try {
      const sql = postgres(process.env.POSTGRES_URL, {
        max: 1,
        idle_timeout: 5,
        connect_timeout: 5
      });
      await sql`SELECT 1`;
      await sql.end({ timeout: 2 });
      database = "ok";
    } catch {
      database = "error";
    }
  }

  const memory = process.memoryUsage();
  const activeKeys = pool.filter((x) => x.enabled);
  const readyKeys = activeKeys.filter((x) => x.status === "ready");
  const ok = database === "ok";

  return corsJson(req, {
    ok,
    service: "MC-Translate-Studio",
    status: ok ? "online" : "degraded",
    creditMode: process.env.CREDIT_MODE || "nvnmc.cloud",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    node: process.version,
    runtime: process.env.VERCEL ? "vercel" : "node",
    environment: process.env.VERCEL_ENV || "unknown",
    database,
    blob: process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN
      ? "configured-or-oidc"
      : "not-configured",
    queue: process.env.VERCEL ? "vercel-queue-ready" : "requires-vercel",
    activeKeys: activeKeys.length,
    readyKeys: readyKeys.length,
    aiProviders: [...new Set(readyKeys.map((x) => x.provider))],
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024)
    },
    timestamp: new Date().toISOString()
  }, { status: ok ? 200 : 503 });
}
