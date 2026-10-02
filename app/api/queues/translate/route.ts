import { handleCallback } from "@vercel/queue";
import { completeJob, failJob, getJob, claimJob } from "@/lib/jobs";
import { translateZip } from "@/lib/pack";
import { generateTranslation } from "@/lib/ai";
import { translateLocal } from "@/lib/local-translator";
import { issueSignedToken, presignUrl, put } from "@vercel/blob";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

const queueHandler = handleCallback(async (message: any, metadata: any) => {
  const jobId = String(message.jobId || metadata.messageId);

  try {
    const existing = await getJob(jobId);
    if (!existing) throw new Error("Translation job was not found in PostgreSQL");
    if (existing.status === "completed") return;

    const claimed = await claimJob(jobId);
    if (!claimed) {
      const latest = await getJob(jobId);
      if (latest?.status === "completed") return;
      if (latest?.status === "processing") return;
      throw new Error("Translation job is not claimable");
    }

    const p = message.payload || claimed.payload || {};
    if (!p.pathname) throw new Error("translate job requires pathname");

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

    const response = await fetch(inputUrl);
    if (!response.ok) throw new Error("Input download failed: HTTP " + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());

    const max = Number(process.env.MAX_FILE_MB || 50) * 1024 * 1024;
    if (bytes.length > max) throw new Error("Input exceeds " + max / 1024 / 1024 + " MB");

    const target = String(p.target || "Vietnamese");
    const engine = p.engine === "local" ? "local" : "ai";
    const customGlossary = p.glossary && typeof p.glossary === "object" ? p.glossary : {};

    const result = await translateZip(
      bytes,
      target,
      (source: string, language: string, filePath: string) =>
        engine === "local"
          ? Promise.resolve(translateLocal(source, language, filePath, customGlossary))
          : generateTranslation(source, language, filePath)
    );

    const name = String(p.fileName || "pack.zip").replace(/[\\r\\n"]/g, "_");
    const ext = name.match(/\\.(mcaddon|mcpack|zip|jar)$/i)?.[0]?.toLowerCase() || ".zip";
    const base = name.replace(/\\.(mcaddon|mcpack|zip|jar)$/i, "");
    const pathname = "translations/" + crypto.randomUUID() + "-translated-" + base + ext;

    await put(pathname, Buffer.from(result.buffer), {
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

    const output = {
      jobId,
      status: "completed",
      url: downloadUrl,
      expiresAt: Date.now() + 30 * 60 * 1000,
      target,
      engine,
      translatedFiles: result.translated,
      deliveryCount: metadata.deliveryCount
    };

    await completeJob(jobId, output);
  } catch (error: any) {
    const messageText = error?.message || "Translation job failed";
    const current = await getJob(jobId);
    if (current?.status === "processing") {
      await failJob(jobId, messageText, Number(metadata.deliveryCount || 1) < 4);
    }
    throw error;
  }
});

export async function POST(request: Request) {
  return queueHandler({ request });
}
