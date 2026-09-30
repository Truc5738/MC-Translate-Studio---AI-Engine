import { NextRequest } from "next/server";
import { send } from "@vercel/queue";
import { enqueueJob } from "@/lib/jobs";
import { corsJson } from "@/lib/cors";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return corsJson(req, { ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fileUrl = String(body?.fileUrl || "");
    const fileName = String(body?.fileName || "pack.zip").replace(/[\r\n"\\/]/g, "_");
    const target = String(body?.target || "Vietnamese").slice(0, 100);
    if (!/^https:\/\//i.test(fileUrl)) return corsJson(req, { ok: false, error: "fileUrl must be HTTPS" }, { status: 400 });
    const id = crypto.randomUUID();
    const payload = { fileUrl, fileName, target };
    await enqueueJob(id, "translate", payload);
    await send("mc-translate", { jobId: id, type: "translate", payload }, { idempotencyKey: id });
    return corsJson(req, { ok: true, jobId: id, status: "queued" }, { status: 202 });
  } catch (error: any) {
    return corsJson(req, { ok: false, error: error?.message || "Unable to queue translation" }, { status: 500 });
  }
}
