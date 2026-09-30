import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security";
import { listJobs } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Number(req.nextUrl.searchParams.get("limit") || 50);
  const jobs = await listJobs(limit);
  return NextResponse.json({ ok: true, count: jobs.length, jobs });
}
