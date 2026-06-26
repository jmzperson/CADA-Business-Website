const DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:5500", "null"];

export function marketingOrigins(): string[] {
  const fromEnv = process.env.MARKETING_SITE_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_ORIGINS;
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const allowed = marketingOrigins();
  const match =
    origin &&
    (allowed.includes(origin) ||
      allowed.includes("*") ||
      (origin.startsWith("file://") && allowed.includes("null")));

  return {
    "Access-Control-Allow-Origin": match ? origin! : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
