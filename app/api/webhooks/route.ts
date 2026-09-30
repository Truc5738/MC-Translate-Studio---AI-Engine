import { NextRequest, NextResponse } from "next/server";
import { send } from "@vercel/queue";
import { eventIdFromRequest, recordWebhookEvent, verifyWebhookSignature } from "@/lib/webhooks";
import { enqueueJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BODY = 1024 * 1024;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY) return NextResponse.json({ ok: false, error: "Webhook payload too large" }, { status: 413 });

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const signature = req.headers.get("x-webhook-signature");
    if (!verifyWebhookSignature(rawBody, signature)) return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });

    const eventId = eventIdFromRequest(req.headers, payload);
    const type = req.headers.get("x-webhook-event") || payload?.type || "generic";
    const source = req.headers.get("x-webhook-source") || "external";
    const result = await recordWebhookEvent({
      id: eventId, type: String(type).slice(0, 200), source: String(source).slice(0, 200),
      receivedAt: new Date().toISOString(), payload
    });

    if (result.duplicate) {
      if (type === "translate.requested") {
        try {
          const jobPayload = payload?.payload || payload;
          await enqueueJob(eventId, "translate", jobPayload);
          await send("mc-translate", { jobId: eventId, type: "translate", payload: jobPayload }, { idempotencyKey: eventId });
        } catch {}
      }
      return NextResponse.json({ ok: true, duplicate: true, eventId, status: "already_received" });
    }

    if (type === "translate.requested") {
      const jobPayload = payload?.payload || payload;
      if (!jobPayload?.fileUrl) {
        return NextResponse.json({ ok: false, error: "translate.requested requires fileUrl" }, { status: 400 });
      }
      await enqueueJob(eventId, "translate", jobPayload);
      await send("mc-translate", { jobId: eventId, type: "translate", payload: jobPayload }, { idempotencyKey: eventId });
    }

    return NextResponse.json({
      ok: true, accepted: true, eventId, eventType: type, stored: result.stored,
      status: type === "translate.requested" ? "queued" : "accepted"
    }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Webhook processing failed" }, { status: 500 });
  }
}
