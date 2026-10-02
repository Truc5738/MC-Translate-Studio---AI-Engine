import { NextRequest } from "next/server";
import { send } from "@vercel/queue";
import { enqueueJob, getJobByUploadId } from "@/lib/jobs";
import { corsJson } from "@/lib/cors";
import crypto from "node:crypto";
import { getUploadSession, consumeUploadSession } from "@/lib/uploads";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return corsJson(req, { ok: true });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "job-create", 5, 60_000);
  const blocked = rateLimitResponse(req, limited);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const uploadId = String(body?.uploadId || "");
    const target = String(body?.target || "Vietnamese").trim().slice(0, 100);

    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) {
      return corsJson(req, { ok: false, error: "Invalid upload session" }, { status: 400 });
    }

    const existing = await getJobByUploadId(uploadId);
    if (existing) {
      return corsJson(req, {
        ok: true,
        jobId: existing.id,
        status: existing.status
      }, { status: 200 });
    }

    const session = await getUploadSession(uploadId);
    if (!session) {
      return corsJson(req, { ok: false, error: "Upload session not found" }, { status: 404 });
    }
    if (session.usedAt) {
      return corsJson(req, { ok: false, error: "Upload session has already been used" }, { status: 409 });
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return corsJson(req, { ok: false, error: "Upload session expired" }, { status: 410 });
    }

    const consumed = await consumeUploadSession(uploadId);
    const id = crypto.randomUUID();
    const payload = {
      pathname: consumed.pathname,
      fileName: consumed.fileName,
      target
    };

    try {
      await enqueueJob(id, "translate", payload, uploadId);
    } catch (error: any) {
      const duplicate = await getJobByUploadId(uploadId);
      if (duplicate) {
        return corsJson(req, {
          ok: true,
          jobId: duplicate.id,
          status: duplicate.status
        }, { status: 200 });
      }
      throw error;
    }

    try {
      await send(
        "mc-translate",
        { jobId: id, type: "translate", payload },
        { idempotencyKey: id }
      );
    } catch (error) {
      throw new Error(
        "Translation job was stored but could not be published to Queue: " +
        (error instanceof Error ? error.message : String(error))
      );
    }

    return corsJson(req, { ok: true, jobId: id, status: "queued" }, { status: 202 });
  } catch (error: any) {
    return corsJson(req, {
      ok: false,
      error: error?.message || "Unable to queue translation"
    }, { status: 500 });
  }
}
