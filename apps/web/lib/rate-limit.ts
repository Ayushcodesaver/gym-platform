import { NextRequest } from "next/server";

/**
 * In-process sliding-window rate limiter (master prompt §60).
 * Scope: single server instance — for multi-instance deployments back this with
 * Redis/Upstash (interface is intentionally narrow: check() → boolean).
 * Never rate-limit the payment webhook by IP: it is authenticated by HMAC.
 */
const buckets = new Map<string, number[]>();

export interface RateLimitOptions {
  /** Maximum requests inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0]!.trim() : null) ?? req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit(
  req: NextRequest,
  route: string,
  { limit, windowMs }: RateLimitOptions,
): { ok: boolean; retryAfterSeconds: number } {
  const key = `${route}:${clientKey(req)}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const hits = (buckets.get(key) ?? []).filter((t) => t > windowStart);
  if (hits.length >= limit) {
    const retryAfterSeconds = Math.ceil((hits[0]! + windowMs - now) / 1000);
    buckets.set(key, hits);
    return { ok: false, retryAfterSeconds };
  }
  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so the map cannot grow unbounded (resource-exhaustion discipline)
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= windowStart)) buckets.delete(k);
    }
  }
  return { ok: true, retryAfterSeconds: 0 };
}
