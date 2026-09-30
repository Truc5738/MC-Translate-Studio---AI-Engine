import { NextResponse } from "next/server";

const DEFAULT_STATIC_ORIGINS = ["https://truc5738.github.io"];

export function allowedOrigin(req: Request) {
  const configured = (process.env.STATIC_SITE_ORIGINS || process.env.STATIC_SITE_ORIGIN || "")
    .split(",").map(x => x.trim()).filter(Boolean);
  const allowed = configured.length ? configured : DEFAULT_STATIC_ORIGINS;
  const origin = req.headers.get("origin") || "";
  if (!origin) return "";
  if (allowed.includes("*")) return "*";
  return allowed.includes(origin) ? origin : "";
}

export function corsHeaders(req: Request) {
  const origin = allowedOrigin(req);
  return {
    ...(origin ? {"Access-Control-Allow-Origin": origin, "Vary": "Origin"} : {}),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

export function corsResponse(req: Request, body: BodyInit | null = null, init: ResponseInit = {}) {
  return new Response(body, { ...init, headers: { ...corsHeaders(req), ...(init.headers || {}) } });
}

export function corsJson(req: Request, data: unknown, init: ResponseInit = {}) {
  return corsResponse(req, JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(init.headers || {}) }
  });
}
