import crypto from "node:crypto";
import postgres from "postgres";

export type WebhookEvent = {
  id: string;
  type: string;
  source: string;
  receivedAt: string;
  payload: unknown;
};

let sql: ReturnType<typeof postgres> | null = null;

function db() {
  const url = process.env.POSTGRES_URL;
  if (!url) return null;
  if (!sql) sql = postgres(url, { max: 2, idle_timeout: 20 });
  return sql;
}

export async function ensureWebhookTables() {
  const client = db();
  if (!client) return false;
  await client`
    CREATE TABLE IF NOT EXISTS mc_webhook_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS mc_webhook_events_created_idx
    ON mc_webhook_events (created_at DESC)
  `;
  return true;
}

export async function recordWebhookEvent(event: WebhookEvent) {
  const client = db();
  if (!client) return { stored: false, duplicate: false };

  await ensureWebhookTables();
  const rows = await client`
    INSERT INTO mc_webhook_events (id, type, source, payload)
    VALUES (${event.id}, ${event.type}, ${event.source}, ${JSON.stringify(event.payload)}::jsonb)
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  return { stored: true, duplicate: rows.length === 0 };
}

export async function markWebhookProcessed(id: string) {
  const client = db();
  if (!client) return;
  await client`
    UPDATE mc_webhook_events
    SET status = 'processed', processed_at = NOW(), error = NULL
    WHERE id = ${id}
  `;
}

export async function markWebhookFailed(id: string, error: string) {
  const client = db();
  if (!client) return;
  await client`
    UPDATE mc_webhook_events
    SET status = 'failed', attempts = attempts + 1, error = ${error.slice(0, 2000)}
    WHERE id = ${id}
  `;
}

export async function listWebhookEvents(limit = 50) {
  const client = db();
  if (!client) return [];
  await ensureWebhookTables();
  return client`
    SELECT id, type, source, status, attempts, error, created_at, processed_at
    FROM mc_webhook_events
    ORDER BY created_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 100)}
  `;
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing WEBHOOK_SECRET");

  if (!signature) return false;
  const supplied = signature.replace(/^sha256=/, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(supplied, "hex"),
    Buffer.from(expected, "hex")
  );
}

export function eventIdFromRequest(headers: Headers, payload: any) {
  const explicit =
    headers.get("x-webhook-id") ||
    headers.get("x-github-delivery") ||
    payload?.id ||
    payload?.event_id;

  if (explicit && String(explicit).length <= 200) return String(explicit);

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}
