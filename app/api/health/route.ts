import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "MC-Translate-Studio",
    creditMode: "nvnmc.cloud",
    timestamp: new Date().toISOString(),
  });
}
