import { NextRequest } from "next/server";
import { listJobs } from "@/lib/jobs";
import { corsJson } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return corsJson(req, { ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobs = await listJobs(100);
  const job = jobs.find((item: any) => String(item.id) === id);
  if (!job) return corsJson(req, { ok: false, error: "Job not found" }, { status: 404 });
  return corsJson(req, { ok: true, job });
}
