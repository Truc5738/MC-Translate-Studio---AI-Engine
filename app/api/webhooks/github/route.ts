import { NextRequest, NextResponse } from "next/server";
import { send } from "@vercel/queue";
import crypto from "node:crypto";
import {
  eventIdFromRequest,
  markWebhookProcessed,
  recordWebhookEvent
} from "@/lib/webhooks";
import { enqueueJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyGitHub(rawBody: string, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function translationPayload(payload: any) {
  const explicit = payload?.translate || payload?.translation || {};
  return {
    fileUrl: explicit.fileUrl || payload?.fileUrl,
    fileName: explicit.fileName || payload?.fileName,
    target: explicit.target || payload?.target || "Vietnamese",
    callbackUrl: explicit.callbackUrl || payload?.callbackUrl
  };
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

  try {
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

    const requested =
      type === "translate.requested" ||
      (type === "repository_dispatch" && payload?.action === "translate.requested");

    const jobPayload = translationPayload(payload);

    if (requested) {
      if (!jobPayload.fileUrl) {
        return NextResponse.json({
          ok: false,
          error: "Translation event requires translate.fileUrl or fileUrl"
        }, { status: 400 });
      }

      await enqueueJob(eventId, "translate", jobPayload);
      await send(
        "mc-translate",
        { jobId: eventId, type: "translate", payload: jobPayload },
        { idempotencyKey: eventId }
      );
    }

    await markWebhookProcessed(eventId);

    return NextResponse.json({
      ok: true,
      accepted: true,
      eventId,
      eventType: type,
      queued: requested,
      status: requested ? "queued" : "received"
    }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Webhook processing failed" }, { status: 500 });
  }
}
