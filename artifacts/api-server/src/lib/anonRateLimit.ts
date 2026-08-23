import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { AuthedRequest } from "./auth";

/**
 * IP-based rate limiter for ANONYMOUS callers on expensive (AI-backed)
 * endpoints. Authenticated users are exempt here because their usage is
 * already metered via consumeAction / billing limits; visitors previously had
 * no throttle at all, letting anyone burn OpenAI credits without an account.
 *
 * Fixed-window counter per client IP, shared across all endpoints the
 * limiter instance is applied to. In-memory on purpose: this API runs as a
 * single process, and losing counters on restart is acceptable for an
 * abuse-prevention budget.
 */

interface WindowEntry {
  count: number;
  windowStartMs: number;
}

export interface AnonRateLimitOptions {
  /** Max anonymous requests per IP per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /**
   * When false, authenticated users are ALSO limited (bucketed per user id
   * instead of per IP). Use for endpoints with no billing-layer metering,
   * e.g. analytics events, where any account could otherwise write
   * unbounded rows. Defaults to true (AI endpoints: billing meters users).
   */
  exemptAuthenticated?: boolean;
}

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

export function clientIp(req: Request): string {
  // Express populates req.ip from X-Forwarded-For when "trust proxy" is set
  // (the app always runs behind Replit's proxy). Fall back to the socket
  // address, and bucket unknown sources together rather than exempting them.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createAnonRateLimiter(options: AnonRateLimitOptions): RequestHandler & {
  /** Test hook: clear all counters. */
  reset: () => void;
} {
  const { max, windowMs, exemptAuthenticated = true } = options;
  const buckets = new Map<string, WindowEntry>();
  let lastCleanupMs = Date.now();

  const middleware = ((req: Request, res: Response, next: NextFunction): void => {
    // Authenticated users are metered by the billing layer instead
    // (unless this limiter explicitly covers them too).
    const userId = (req as AuthedRequest).userId as string | undefined;
    if (userId && exemptAuthenticated) {
      next();
      return;
    }

    const now = Date.now();

    // Opportunistic cleanup so the map cannot grow without bound.
    if (now - lastCleanupMs > CLEANUP_INTERVAL_MS) {
      lastCleanupMs = now;
      for (const [key, entry] of buckets) {
        if (now - entry.windowStartMs >= windowMs) buckets.delete(key);
      }
    }

    const bucketKey = userId ? `u:${userId}` : clientIp(req);
    const entry = buckets.get(bucketKey);

    if (!entry || now - entry.windowStartMs >= windowMs) {
      buckets.set(bucketKey, { count: 1, windowStartMs: now });
      next();
      return;
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((entry.windowStartMs + windowMs - now) / 1000),
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: "RATE_LIMITED",
        message:
          "Too many requests. Please try again later, or sign in to continue.",
      });
      return;
    }

    entry.count += 1;
    next();
  }) as RequestHandler & { reset: () => void };

  middleware.reset = () => buckets.clear();
  return middleware;
}

/**
 * Shared limiter for the anonymous-accessible AI endpoints
 * (/api/parse-quote and /api/apply-voice-command). Generous enough for a
 * genuine visitor building a quote, far below what abuse requires.
 */
export const anonAiRateLimiter = createAnonRateLimiter({
  max: 30,
  windowMs: 60 * 60 * 1000, // 1 hour
});
