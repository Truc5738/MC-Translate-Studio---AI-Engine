import { NextRequest, NextResponse } from "next/server";
import { claimJobs, completeJob, failJob } from "@/lib/jobs";
import { translateZip } from "@/lib/pack";
import { generateTranslation } from "@/lib/ai";
import { translateLocal } from "@/lib/local-translator";
import { issueSignedToken, presignUrl, put } from "@vercel/blob";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === "Bearer " + secret;
}

async function notify(url: unknown, data: unknown) {
  if (typeof url !== "string" || !url) return;
  const body = JSON.stringify(data);
  const secret = process.env.WEBHOOK_SECRET;
  const signature = secret
    ? "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex")
    : undefined;

  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-webhook-signature": signature } : {})
    },
    body
  });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await claimJobs(Number(process.env.MAX_CONCURRENT_JOBS || 2));
  const results: any[] = [];

  for (const job of jobs as any[]) {
    try {
      if (job.type !== "translate") {
        throw new Error("Only translate jobs are enabled in this processor");
      }

      const p = job.payload || {};
      if (!p.pathname) throw new Error("Translation job requires pathname");

      const inputToken = await issueSignedToken({
        pathname: String(p.pathname),
        operations: ["get"],
        validUntil: Date.now() + 10 * 60 * 1000
      });

      const { presignedUrl: inputUrl } = await presignUrl(inputToken, {
        pathname: String(p.pathname),
        operation: "get",
        validUntil: Date.now() + 10 * 60 * 1000,
        access: "private"
      });

      const input = await fetch(inputUrl);
      if (!input.ok) throw new Error("Input download failed: HTTP " + input.status);

      const bytes = Buffer.from(await input.arrayBuffer());
      const max = Number(process.env.MAX_FILE_MB || 50) * 1024 * 1024;
      if (bytes.length > max) {
        throw new Error("Input exceeds " + max / 1024 / 1024 + " MB");
      }

      const target = String(p.target || "Vietnamese");
      const engine = p.engine === "local" ? "local" : "ai";
      const customGlossary =
        p.glossary && typeof p.glossary === "object" ? p.glossary : {};

      const translated = await translateZip(
        bytes,
        target,
        (source: string, language: string, filePath: string) =>
          engine === "local"
            ? Promise.resolve(translateLocal(source, language, filePath, customGlossary))
            : generateTranslation(source, language, filePath)
      );

      const name = String(p.fileName || "pack.zip").replace(/[\r\n"]/g, "_");
      const ext =
        name.match(/\.(mcaddon|mcpack|zip|jar)$/i)?.[0]?.toLowerCase() || ".zip";
      const base = name.replace(/\.(mcaddon|mcpack|zip|jar)$/i, "");
      const pathname =
        "translations/" + crypto.randomUUID() + "-translated-" + base + ext;

      await put(pathname, Buffer.from(translated.buffer), {
        access: "private",
        allowOverwrite: false
      });

      const outputToken = await issueSignedToken({
        pathname,
        operations: ["get"],
        validUntil: Date.now() + 30 * 60 * 1000
      });

      const { presignedUrl: downloadUrl } = await presignUrl(outputToken, {
        pathname,
        operation: "get",
        validUntil: Date.now() + 30 * 60 * 1000,
        access: "private"
      });

      const result = {
        jobId: job.id,
        status: "completed",
        url: downloadUrl,
        expiresAt: Date.now() + 30 * 60 * 1000,
        target,
        engine,
        translatedFiles: translated.translated
      };

      await completeJob(job.id, result);
      await notify(p.callbackUrl, result);
      results.push(result);
    } catch (error: any) {
      const message = error?.message || "Job failed";
      const retry = Number(job.attempts || 0) < 3;
      await failJob(job.id, message, retry);
      try {
        await notify(job.payload?.callbackUrl, {
          jobId: job.id,
          status: retry ? "retrying" : "failed",
          error: message
        });
      } catch {}
      results.push({
        jobId: job.id,
        status: retry ? "retrying" : "failed",
        error: message
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results
  });
}
