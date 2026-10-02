import postgres from "postgres";

export type UploadSession = {
  id: string;
  pathname: string;
  fileName: string;
  size: number;
  contentType: string;
  expiresAt: string;
  usedAt: string | null;
};

let sql: ReturnType<typeof postgres> | null = null;

function db() {
  const url = process.env.POSTGRES_URL;
  if (!url) return null;
  if (!sql) sql = postgres(url, { max: 4, idle_timeout: 20, ssl: "require" });
  return sql;
}

async function ensureTable() {
  const client = db();
  if (!client) throw new Error("POSTGRES_URL is required for upload sessions.");
  await client`
    CREATE TABLE IF NOT EXISTS mc_upload_sessions (
      id TEXT PRIMARY KEY,
      pathname TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      size BIGINT NOT NULL,
      content_type TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS mc_upload_sessions_expiry_idx ON mc_upload_sessions(expires_at)`;
}

export async function createUploadSession(input: {
  id: string;
  pathname: string;
  fileName: string;
  size: number;
  contentType: string;
  expiresAt: number;
}) {
  const client = db();
  if (!client) throw new Error("POSTGRES_URL is required for upload sessions.");
  await ensureTable();
  await client`
    INSERT INTO mc_upload_sessions
      (id, pathname, file_name, size, content_type, expires_at)
    VALUES
      (${input.id}, ${input.pathname}, ${input.fileName}, ${input.size}, ${input.contentType}, to_timestamp(${input.expiresAt / 1000}))
  `;
}

export async function getUploadSession(id: string) {
  const client = db();
  if (!client) return null;
  await ensureTable();
  const rows = await client`
    SELECT
      id,
      pathname,
      file_name AS "fileName",
      size,
      content_type AS "contentType",
      expires_at AS "expiresAt",
      used_at AS "usedAt"
    FROM mc_upload_sessions
    WHERE id = ${id}
    LIMIT 1
  `;
  return (rows[0] as UploadSession | undefined) || null;
}

export async function consumeUploadSession(id: string) {
  const client = db();
  if (!client) throw new Error("POSTGRES_URL is required for upload sessions.");
  await ensureTable();

  return client.begin(async (tx) => {
    const rows = await tx`
      SELECT
        id,
        pathname,
        file_name AS "fileName",
        size,
        content_type AS "contentType",
        expires_at AS "expiresAt",
        used_at AS "usedAt"
      FROM mc_upload_sessions
      WHERE id = ${id}
      FOR UPDATE
    `;

    const session = rows[0] as UploadSession | undefined;
    if (!session) throw new Error("Upload session not found.");
    if (session.usedAt) throw new Error("Upload session has already been consumed.");
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new Error("Upload session has expired.");
    }

    await tx`
      UPDATE mc_upload_sessions
      SET used_at = NOW()
      WHERE id = ${id}
    `;

    return session;
  });
}
