import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security";
import { listWebhookEvents } from "@/lib/webhooks";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Number(req.nextUrl.searchParams.get("limit") || 50);
  const events = await listWebhookEvents(limit);
  return NextResponse.json({ ok: true, count: events.length, events });
}
