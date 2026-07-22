import { sql, eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  usageCountersTable,
  templatesTable,
} from "@workspace/db";

// Free-tier limits. Pro subscribers are unlimited; credits are consumed
// before free-tier limits apply.
export const FREE_LIMITS = {
  templates: 5,
  newQuotes: 3,
  voiceEdits: 3,
  emailsSent: 3,
  pdfDownloads: 3,
} as const;

export type MeteredAction =
  | "newQuotes"
  | "voiceEdits"
  | "emailsSent"
  | "pdfDownloads";

export class LimitReachedError extends Error {
  readonly action: string;
  constructor(action: string) {
    super(`Free tier limit reached for ${action}`);
    this.action = action;
  }
}

/** Current usage period ("YYYY-MM") in Australia/Sydney time. */
export function currentPeriod(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

export interface SubscriptionInfo {
  plan: "pro" | "free";
  subscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

/**
 * Derives the user's plan from the synced stripe.subscriptions mirror.
 * "pro" while the subscription is active or trialing — including after a
 * cancellation, until the end of the paid period.
 */
export async function getSubscriptionInfo(
  userId: string,
): Promise<SubscriptionInfo> {
  const [profile] = await db
    .select({
      subscriptionId: userProfilesTable.stripeSubscriptionId,
      plan: userProfilesTable.plan,
      subscriptionStatus: userProfilesTable.subscriptionStatus,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  const subscriptionId = profile?.subscriptionId ?? null;
  if (!subscriptionId) {
    if (profile && profile.plan !== "free") {
      // Defensive: no subscription reference — profile must say free.
      await setProfileSubscriptionState(userId, "free", profile.subscriptionStatus === "never" ? "never" : "cancelled");
    }
    return {
      plan: "free",
      subscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    };
  }

  const result = await db.execute(sql`
    SELECT s.status,
           s.cancel_at_period_end,
           to_char(
             to_timestamp((i.value ->> 'current_period_end')::bigint) AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS"Z"'
           ) AS current_period_end
    FROM stripe.subscriptions s
    LEFT JOIN LATERAL jsonb_array_elements(s.items -> 'data') i(value) ON true
    WHERE s.id = ${subscriptionId}
    LIMIT 1
  `);
  const row = result.rows[0] as
    | {
        status: string;
        cancel_at_period_end: boolean | null;
        current_period_end: string | null;
      }
    | undefined;

  // The stripe.* mirror syncs asynchronously. Right after checkout the
  // subscription row may not exist here yet, even though /billing/confirm
  // verified the payment with Stripe directly and set the profile to
  // paid/active. In that window, trust the profile — never downgrade on a
  // missing row.
  if (!row) {
    const trustedPro = profile?.plan === "paid";
    return {
      plan: trustedPro ? "pro" : "free",
      subscriptionId,
      cancelAtPeriodEnd: trustedPro
        ? profile?.subscriptionStatus === "cancelled"
        : false,
      currentPeriodEnd: null,
    };
  }

  const active = row.status === "active" || row.status === "trialing";
  const cancelAtPeriodEnd = active ? Boolean(row.cancel_at_period_end) : false;

  // Reconcile the denormalised user_profiles columns (#43) — only when the
  // mirror has an authoritative row with a terminal/non-active status.
  const expectedPlan: ProfilePlan = active ? "paid" : "free";
  const expectedStatus: ProfileSubscriptionStatus =
    active && !cancelAtPeriodEnd ? "active" : "cancelled";
  if (
    profile &&
    (profile.plan !== expectedPlan ||
      profile.subscriptionStatus !== expectedStatus)
  ) {
    await setProfileSubscriptionState(userId, expectedPlan, expectedStatus);
  }

  return {
    plan: active ? "pro" : "free",
    subscriptionId,
    cancelAtPeriodEnd,
    currentPeriodEnd: active ? (row?.current_period_end ?? null) : null,
  };
}

// ---- Denormalised subscription state on user_profiles (#43) ----

export type ProfilePlan = "free" | "paid";
export type ProfileSubscriptionStatus = "never" | "active" | "cancelled";

/**
 * Writes the denormalised plan/subscription_status columns on user_profiles.
 * Called from checkout confirm, cancel, undo-cancel, and the reconciliation
 * inside getSubscriptionInfo — every path that changes subscription state
 * (including any manual/admin cancellation that goes through these routes)
 * must use this same helper so the profile always mirrors Stripe.
 */
export async function setProfileSubscriptionState(
  userId: string,
  plan: ProfilePlan,
  subscriptionStatus: ProfileSubscriptionStatus,
): Promise<void> {
  await db
    .update(userProfilesTable)
    .set({ plan, subscriptionStatus, updatedAt: new Date() })
    .where(eq(userProfilesTable.userId, userId));
}

export interface ConsumeResult {
  source: "pro" | "credit" | "free";
  creditsRemaining: number;
}

/**
 * Authorizes and records one metered action for the user.
 * Order (per spec): Pro subscription → credits → free-tier allowance.
 * Throws LimitReachedError when none apply. Runs in a transaction with a
 * per-user advisory lock so concurrent requests cannot double-spend.
 */
export async function consumeAction(
  userId: string,
  action: MeteredAction,
): Promise<ConsumeResult> {
  // Defensive guard: metering only applies to logged-in users. Visitors are
  // never metered — routes that allow anonymous access must skip this call,
  // but if one slips through, treat it as a free (unmetered) action rather
  // than corrupting counters with an empty user id.
  if (!userId) {
    return { source: "free", creditsRemaining: 0 };
  }
  const sub = await getSubscriptionInfo(userId);

  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${"billing:" + userId}))`,
    );

    const [profile] = await tx
      .select({ credits: userProfilesTable.credits })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));
    const credits = profile?.credits ?? 0;

    if (sub.plan === "pro") {
      return { source: "pro" as const, creditsRemaining: credits };
    }

    if (credits > 0) {
      await tx
        .update(userProfilesTable)
        .set({ credits: credits - 1, updatedAt: new Date() })
        .where(eq(userProfilesTable.userId, userId));
      return { source: "credit" as const, creditsRemaining: credits - 1 };
    }

    const period = currentPeriod();
    const [counter] = await tx
      .insert(usageCountersTable)
      .values({ userId, period })
      .onConflictDoNothing()
      .returning();
    const [row] = counter
      ? [counter]
      : await tx
          .select()
          .from(usageCountersTable)
          .where(
            sql`${usageCountersTable.userId} = ${userId} AND ${usageCountersTable.period} = ${period}`,
          );

    const used = row?.[action] ?? 0;
    if (used >= FREE_LIMITS[action]) {
      throw new LimitReachedError(action);
    }

    await tx
      .update(usageCountersTable)
      .set({ [action]: used + 1, updatedAt: new Date() })
      .where(
        sql`${usageCountersTable.userId} = ${userId} AND ${usageCountersTable.period} = ${period}`,
      );
    return { source: "free" as const, creditsRemaining: credits };
  });
}

/** Transaction handle passed to `authorizeTemplateSave` callbacks. */
export type BillingTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Authorizes saving a NEW template. Free users get 5 template slots; beyond
 * that a credit is consumed (if available), otherwise the save is blocked.
 * Editing existing templates is never gated.
 *
 * The optional `run` callback executes INSIDE the same transaction (while the
 * per-user advisory lock is held), so the slot check and the template insert
 * are atomic — two concurrent saves cannot both pass the free-slot check.
 */
export async function authorizeTemplateSave<T = void>(
  userId: string,
  run?: (tx: BillingTx) => Promise<T>,
): Promise<{ auth: ConsumeResult; result: T | undefined }> {
  const sub = await getSubscriptionInfo(userId);

  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${"billing:" + userId}))`,
    );

    const [profile] = await tx
      .select({ credits: userProfilesTable.credits })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));
    const credits = profile?.credits ?? 0;

    let auth: ConsumeResult | null = null;

    if (sub.plan === "pro") {
      auth = { source: "pro" as const, creditsRemaining: credits };
    } else {
      const [{ count }] = (
        await tx.execute(
          sql`SELECT count(*)::int AS count FROM ${templatesTable} WHERE ${templatesTable.userId} = ${userId}`,
        )
      ).rows as [{ count: number }];

      if (count < FREE_LIMITS.templates) {
        auth = { source: "free" as const, creditsRemaining: credits };
      } else if (credits > 0) {
        await tx
          .update(userProfilesTable)
          .set({ credits: credits - 1, updatedAt: new Date() })
          .where(eq(userProfilesTable.userId, userId));
        auth = { source: "credit" as const, creditsRemaining: credits - 1 };
      } else {
        throw new LimitReachedError("templates");
      }
    }

    const result = run ? await run(tx) : undefined;
    return { auth, result };
  });
}

/**
 * Reverses a prior consumeAction when the underlying operation failed after
 * consumption (e.g. the email provider rejected the send).
 */
export async function refundAction(
  userId: string,
  action: MeteredAction,
  source: ConsumeResult["source"],
): Promise<void> {
  if (source === "pro") return;
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${"billing:" + userId}))`,
    );
    if (source === "credit") {
      await tx
        .update(userProfilesTable)
        .set({
          credits: sql`${userProfilesTable.credits} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(userProfilesTable.userId, userId));
      return;
    }
    const period = currentPeriod();
    await tx.execute(sql`
      UPDATE usage_counters
      SET ${sql.raw(COLUMN_BY_ACTION[action])} = GREATEST(${sql.raw(COLUMN_BY_ACTION[action])} - 1, 0),
          updated_at = now()
      WHERE user_id = ${userId} AND period = ${period}
    `);
  });
}

const COLUMN_BY_ACTION: Record<MeteredAction, string> = {
  newQuotes: "new_quotes",
  voiceEdits: "voice_edits",
  emailsSent: "emails_sent",
  pdfDownloads: "pdf_downloads",
};

export interface BillingStatus {
  plan: "pro" | "free";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  credits: number;
  usage: {
    newQuotes: number;
    voiceEdits: number;
    emailsSent: number;
    pdfDownloads: number;
  };
  limits: typeof FREE_LIMITS;
  templatesCount: number;
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const sub = await getSubscriptionInfo(userId);
  const period = currentPeriod();

  const [profile] = await db
    .select({ credits: userProfilesTable.credits })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));

  const [usageRow] = await db
    .select()
    .from(usageCountersTable)
    .where(
      sql`${usageCountersTable.userId} = ${userId} AND ${usageCountersTable.period} = ${period}`,
    );

  const [{ count: templatesCount }] = (
    await db.execute(
      sql`SELECT count(*)::int AS count FROM ${templatesTable} WHERE ${templatesTable.userId} = ${userId}`,
    )
  ).rows as [{ count: number }];

  return {
    plan: sub.plan,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodEnd: sub.currentPeriodEnd,
    credits: profile?.credits ?? 0,
    usage: {
      newQuotes: usageRow?.newQuotes ?? 0,
      voiceEdits: usageRow?.voiceEdits ?? 0,
      emailsSent: usageRow?.emailsSent ?? 0,
      pdfDownloads: usageRow?.pdfDownloads ?? 0,
    },
    limits: FREE_LIMITS,
    templatesCount,
  };
}

/** Express helper: send the standard 402 limit-reached response. */
export function limitReachedResponse(action: string) {
  return {
    error: "Free tier limit reached",
    code: "LIMIT_REACHED" as const,
    action,
  };
}
