import type { Request } from "express";
import { sql, and, eq } from "drizzle-orm";
import { db, anonDailyUsageTable } from "@workspace/db";
import { clientIp } from "./anonRateLimit";

/**
 * Signed-out visitors get a small DAILY budget of AI actions (quote
 * generations + voice edits combined) before being asked to create a free
 * account. Persisted in Postgres — unlike the hourly in-memory IP limiter
 * (which stays as an anti-abuse backstop), this counter must survive
 * restarts/republishes or visitors would get a fresh allowance every deploy.
 *
 * Concurrency model: a slot is RESERVED atomically (conditional increment,
 * only when count < limit) BEFORE the AI call, so parallel requests cannot
 * all sneak past a stale read. Failure paths RELEASE the slot so genuine
 * errors stay free retries.
 *
 * Keyed by the client-generated visitor id when provided ("v:<id>"), falling
 * back to the request IP ("ip:<ip>"). Clearing browser storage mints a new
 * visitor id, but the hourly IP limiter still caps overall anonymous burn.
 *
 * Day boundary is the Sydney calendar day, matching the billing layer's
 * monthly reset convention.
 */
export const ANON_DAILY_LIMIT = 3;

export function sydneyToday(): string {
  // en-CA gives YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function anonDailyKey(req: Request, visitorId?: string | null): string {
  const v =
    typeof visitorId === "string" && visitorId.trim().length >= 8
      ? visitorId.trim().slice(0, 64)
      : null;
  return v ? `v:${v}` : `ip:${clientIp(req)}`;
}

/**
 * Atomically claim one of today's slots. Returns false when the visitor is
 * already at the limit — the caller must respond 429 and skip the AI call.
 * The ON CONFLICT ... WHERE clause makes check+increment a single statement,
 * so concurrent requests can never over-claim.
 */
export async function reserveAnonDaily(key: string): Promise<boolean> {
  const rows = await db
    .insert(anonDailyUsageTable)
    .values({ visitorKey: key, usageDate: sydneyToday(), count: 1 })
    .onConflictDoUpdate({
      target: [anonDailyUsageTable.visitorKey, anonDailyUsageTable.usageDate],
      set: { count: sql`${anonDailyUsageTable.count} + 1` },
      setWhere: sql`${anonDailyUsageTable.count} < ${ANON_DAILY_LIMIT}`,
    })
    .returning({ count: anonDailyUsageTable.count });
  return rows.length > 0;
}

/**
 * Give a reserved slot back when the request failed to produce a usable
 * result (AI error, unparseable response, command not understood) — those
 * are free retries by design.
 */
export async function releaseAnonDaily(key: string): Promise<void> {
  await db
    .update(anonDailyUsageTable)
    .set({ count: sql`greatest(${anonDailyUsageTable.count} - 1, 0)` })
    .where(
      and(
        eq(anonDailyUsageTable.visitorKey, key),
        eq(anonDailyUsageTable.usageDate, sydneyToday()),
      ),
    );
}

/**
 * Standard 429 body for the anonymous daily limit — distinct from the
 * in-memory limiter's RATE_LIMITED and from the signed-in 402 LIMIT_REACHED
 * contract, so the frontend can show the create-account dialog specifically.
 */
export function anonLimitResponse() {
  return {
    code: "ANON_DAILY_LIMIT_REACHED" as const,
    message:
      "You've used your 3 free AI quote actions for today. Create a free account to keep going.",
  };
}
