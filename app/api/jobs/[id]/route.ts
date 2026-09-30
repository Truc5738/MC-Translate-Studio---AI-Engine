import { NextRequest, NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobs = await listJobs(100);
  const job = jobs.find((item: any) => String(item.id) === id);
  if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  return NextResponse.json({ ok: true, job });
}
