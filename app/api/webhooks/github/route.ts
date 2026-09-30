import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  eventIdFromRequest,
  recordWebhookEvent
} from "@/lib/webhooks";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyGitHub(rawBody: string, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (rawBody.length > 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  if (!verifyGitHub(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ ok: false, error: "Invalid GitHub signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = eventIdFromRequest(req.headers, payload);
  const type = req.headers.get("x-github-event") || "unknown";

  const result = await recordWebhookEvent({
    id: eventId,
    type,
    source: "github",
    receivedAt: new Date().toISOString(),
    payload
  });

  if (result.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true, eventId });
  }


  return NextResponse.json({
    ok: true,
    accepted: true,
    eventId,
    eventType: type
  }, { status: 202 });
}
