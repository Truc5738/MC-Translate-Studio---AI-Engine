import { handleCallback } from "@vercel/queue";
import { completeJob, failJob } from "@/lib/jobs";
import { translateZip } from "@/lib/pack";
import { generateTranslation } from "@/lib/ai";
import { put } from "@vercel/blob";
import crypto from "node:crypto";

const queueHandler = handleCallback(async (message: any, metadata: any) => {
  const jobId = String(message.jobId || metadata.messageId);
  try {
    const p = message.payload || {};
    if (!p.fileUrl) throw new Error("translate job requires fileUrl");

    const response = await fetch(String(p.fileUrl));
    if (!response.ok) throw new Error(`Input download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const max = Number(process.env.MAX_FILE_MB || 50) * 1024 * 1024;
    if (bytes.length > max) throw new Error(`Input exceeds ${max/1024/1024} MB`);

    const target = String(p.target || "Vietnamese");
    const result = await translateZip(bytes,target,(source,language,context)=>generateTranslation(source,language,context));
    const name = String(p.fileName || "pack.zip").replace(/[\\r\\n"]/g,"_");
    const ext = name.match(/\\.(mcaddon|mcpack|zip|jar)$/i)?.[0]?.toLowerCase() || ".zip";
    const base = name.replace(/\\.(mcaddon|mcpack|zip|jar)$/i,"");
    const blob = await put(`translations/${crypto.randomUUID()}-translated-${base}${ext}`,new Uint8Array(result.buffer),{access:"public"});

    const output={jobId,status:"completed",url:blob.url,target,translatedFiles:result.translated,deliveryCount:metadata.deliveryCount};
    await completeJob(jobId,output);
  } catch(error:any) {
    await failJob(jobId,error?.message||"Translation job failed",Number(metadata.deliveryCount||1)<4);
    throw error;
  }
});

export async function POST(request: Request) {
  return queueHandler({ request });
}
