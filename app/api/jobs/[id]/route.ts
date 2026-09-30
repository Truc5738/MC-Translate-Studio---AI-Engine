import { NextRequest } from "next/server";
import { listJobs } from "@/lib/jobs";
import { corsJson } from "@/lib/cors";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return corsJson(req, { ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, "job-status", 120, 60_000);
  const blocked = rateLimitResponse(limited);
  if (blocked) return blocked;

  const { id } = await params;
  if (!/^[0-9a-f-]{20,80}$/i.test(id)) {
    return corsJson(req, { ok: false, error: "Invalid job id" }, { status: 400 });
  }
  const jobs = await listJobs(100);
  const job = jobs.find((item: any) => String(item.id) === id);
  if (!job) return corsJson(req, { ok: false, error: "Job not found" }, { status: 404 });
  return corsJson(req, { ok: true, job });
}
