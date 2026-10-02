import postgres from "postgres";

export type JobType = "translate" | "analyze" | "repair";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

let sql: ReturnType<typeof postgres> | null = null;

function db() {
  const url = process.env.POSTGRES_URL;
  if (!url) return null;
  if (!sql) sql = postgres(url, { max: 4, idle_timeout: 20 });
  return sql;
}

export async function ensureJobTables() {
  const client = db();
  if (!client) return false;
  await client`
    CREATE TABLE IF NOT EXISTS mc_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload JSONB NOT NULL,
      result JSONB,
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS mc_jobs_queue_idx ON mc_jobs(status, available_at, created_at)`;
  return true;
}

export async function enqueueJob(id: string, type: JobType, payload: unknown) {
  const client = db();
  if (!client) throw new Error("POSTGRES_URL is required for queued jobs");
  await ensureJobTables();
  const rows = await client`
    INSERT INTO mc_jobs (id, type, payload)
    VALUES (${id}, ${type}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  return { created: rows.length > 0, id };
}

export async function getJob(id: string) {
  const client = db();
  if (!client) return null;
  await ensureJobTables();
  const rows = await client`
    SELECT id, type, status, payload, result, attempts, error, created_at, started_at, completed_at
    FROM mc_jobs WHERE id = ${id} LIMIT 1
  `;
  return rows[0] || null;
}

export async function claimJob(id: string) {
  const client = db();
  if (!client) throw new Error("POSTGRES_URL is required for queued jobs");
  await ensureJobTables();
  const rows = await client`
    UPDATE mc_jobs
    SET status = 'processing', attempts = attempts + 1, started_at = NOW(), error = NULL
    WHERE id = ${id} AND status = 'pending' AND available_at <= NOW()
    RETURNING id, type, payload, attempts
  `;
  return rows[0] || null;
}

export async function claimJobs(limit = 2) {
  const client = db();
  if (!client) return [];
  await ensureJobTables();
  return client.begin(async tx => {
    const jobs = await tx`
      SELECT id, type, payload, attempts
      FROM mc_jobs
      WHERE status = 'pending' AND available_at <= NOW()
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${Math.min(Math.max(limit, 1), 5)}
    `;
    if (!jobs.length) return [];
    const ids = jobs.map((j: any) => j.id);
    await tx`
      UPDATE mc_jobs
      SET status = 'processing', attempts = attempts + 1, started_at = NOW(), error = NULL
      WHERE id = ANY(${ids}::text[])
    `;
    return jobs;
  });
}

export async function completeJob(id: string, result: unknown) {
  const client = db();
  if (!client) return;
  await client`
    UPDATE mc_jobs
    SET status = 'completed', result = ${JSON.stringify(result)}::jsonb,
        completed_at = NOW(), error = NULL
    WHERE id = ${id}
  `;
}

export async function failJob(id: string, error: string, retry = true) {
  const client = db();
  if (!client) return;
  if (retry) {
    await client`
      UPDATE mc_jobs
      SET status = 'pending',
          available_at = NOW() + INTERVAL '30 seconds' * LEAST(attempts, 10),
          error = ${error.slice(0, 2000)}
      WHERE id = ${id} AND status = 'processing'
    `;
  } else {
    await client`
      UPDATE mc_jobs
      SET status = 'failed', error = ${error.slice(0, 2000)}
      WHERE id = ${id} AND status = 'processing'
    `;
  }
}

export async function listJobs(limit = 50) {
  const client = db();
  if (!client) return [];
  await ensureJobTables();
  return client`
    SELECT id, type, status, attempts, error, created_at, started_at, completed_at, result
    FROM mc_jobs ORDER BY created_at DESC LIMIT ${Math.min(Math.max(limit,1),100)}
  `;
}
