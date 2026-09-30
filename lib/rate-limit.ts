import { corsHeaders } from "@/lib/cors";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function key(req: Request, name: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || "anonymous";
  return name + ":" + ip;
}

export function rateLimit(req: Request, name: string, limit: number, windowMs: number) {
  const now = Date.now();
  const k = key(req, name);
  const current = buckets.get(k);

  if (!current || current.resetAt <= now) {
    buckets.set(k, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfter: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }

  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfter: 0 };
}

export function rateLimitResponse(req: Request, result: ReturnType<typeof rateLimit>) {
  if (result.allowed) return null;
  return new Response(JSON.stringify({
    ok: false,
    error: "Rate limit exceeded",
    retryAfter: result.retryAfter
  }), {
    status: 429,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Retry-After": String(result.retryAfter),
      "Cache-Control": "no-store",
      ...corsHeaders(req)
    }
  });
}
