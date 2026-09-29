import { NextResponse } from "next/server";
import { getPoolStatus } from "@/lib/ai-pool";

export const runtime = "nodejs";
const startedAt = Date.now();

export async function GET() {
  const pool = getPoolStatus();
  const memory = process.memoryUsage();
  return NextResponse.json({
    ok: true,
    service: "MC-Translate-Studio",
    status: "online",
    creditMode: process.env.CREDIT_MODE || "nvnmc.cloud",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    node: process.version,
    activeKeys: pool.filter((x) => x.enabled).length,
    readyKeys: pool.filter((x) => x.enabled && x.status === "ready").length,
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024)
    },
    timestamp: new Date().toISOString()
  });
}
