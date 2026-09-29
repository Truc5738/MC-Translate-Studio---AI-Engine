import { NextResponse } from "next/server";
import { estimateCreditCost, type CreditAction } from "@/lib/credits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = body?.action as CreditAction;
  const bytes = Number(body?.bytes);

  if (!["translate", "repair", "analyze"].includes(action) || !Number.isFinite(bytes) || bytes < 0) {
    return NextResponse.json({ error: "Invalid credit estimate request." }, { status: 400 });
  }

  return NextResponse.json({
    action,
    bytes,
    estimatedCost: estimateCreditCost(action, bytes),
    currency: "xu",
    note: "Estimate only. Charge should be performed by the nvnmc.cloud credit service.",
  });
}
