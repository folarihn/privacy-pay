import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter: 60 requests per 60 s per IP per path.
// For multi-replica deployments swap this for Upstash Redis.
const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = requests.get(key);

  if (!entry || now > entry.resetAt) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) return true;
  return false;
}

// Only apply to server-side API routes that touch external services.
const RATE_LIMITED_PATHS = ["/api/rpc", "/api/compliance"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRateLimitedPath = RATE_LIMITED_PATHS.some((p) => pathname.startsWith(p));

  if (!isRateLimitedPath) return NextResponse.next();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const key = `${ip}:${pathname}`;

  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: "Too many requests. Slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Window": "60s",
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/rpc", "/api/compliance/:path*"],
};
