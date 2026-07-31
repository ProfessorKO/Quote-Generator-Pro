import { sql, eq } from "drizzle-orm";
import {
  db,
  couponsTable,
  couponRedemptionsTable,
  userProfilesTable,
} from "@workspace/db";
import { getSubscriptionInfo } from "./billing";

export type CouponErrorCode =
  | "INVALID_CODE" // unknown, inactive, wrong type, or user-specific mismatch
  | "EXPIRED"
  | "MAX_USES_REACHED"
  | "ALREADY_REDEEMED"
  | "ALREADY_PRO";

export class CouponError extends Error {
  readonly code: CouponErrorCode;
  constructor(code: CouponErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface RedeemResult {
  trialDays: number;
  trialEndsAt: Date;
}

/**
 * Validates and redeems a free_trial coupon for the user, granting Pro until
 * now + freeTrialDays (no Stripe involved).
 *
 * All checks and writes run in ONE transaction with the coupon row locked
 * (SELECT ... FOR UPDATE), so max-uses increments are atomic under
 * concurrency; the unique (coupon_id, user_id) constraint independently
 * guarantees no double redemption.
 *
 * User-specific mismatch deliberately returns the same message as an unknown
 * code, so codes reserved for other users are not discoverable by guessing.
 */
export async function redeemCoupon(
  userId: string,
  rawCode: string,
): Promise<RedeemResult> {
  const code = rawCode.trim();
  if (!code) throw new CouponError("INVALID_CODE", "Enter a coupon code.");

  // Users who are already Pro (paid subscription OR an unexpired trial)
  // cannot redeem — trials neither stack nor apply on top of a paid plan.
  const sub = await getSubscriptionInfo(userId);
  if (sub.plan === "pro") {
    throw new CouponError(
      "ALREADY_PRO",
      sub.source === "trial"
        ? "You already have an active Pro trial."
        : "You're already on Pro — this coupon isn't needed.",
    );
  }

  return await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT * FROM ${couponsTable}
      WHERE upper(${couponsTable.code}) = upper(${code})
      FOR UPDATE
    `);
    const coupon = result.rows[0] as
      | {
          id: string;
          discount_type: string;
          free_trial_days: number;
          max_uses: number | null;
          used_count: number;
          user_id: string | null;
          expires_at: string | Date | null;
          is_active: boolean;
        }
      | undefined;

    if (!coupon || !coupon.is_active || coupon.discount_type !== "free_trial") {
      throw new CouponError("INVALID_CODE", "That coupon code isn't valid.");
    }
    if (coupon.user_id && coupon.user_id !== userId) {
      // Same message as unknown code — don't leak other users' codes.
      throw new CouponError("INVALID_CODE", "That coupon code isn't valid.");
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
      throw new CouponError("EXPIRED", "This coupon has expired.");
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      throw new CouponError(
        "MAX_USES_REACHED",
        "This coupon has reached its redemption limit.",
      );
    }

    const trialDays = coupon.free_trial_days;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    const inserted = await tx
      .insert(couponRedemptionsTable)
      .values({ couponId: coupon.id, userId, trialEndsAt })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) {
      throw new CouponError(
        "ALREADY_REDEEMED",
        "You've already used this coupon.",
      );
    }

    await tx
      .update(couponsTable)
      .set({ usedCount: sql`${couponsTable.usedCount} + 1` })
      .where(eq(couponsTable.id, coupon.id));

    // Grant the trial. Never shorten an existing (expired-or-not) window in
    // a race — GREATEST keeps whichever end date is later.
    await tx.execute(sql`
      UPDATE ${userProfilesTable}
      SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, ${trialEndsAt}), ${trialEndsAt}),
          updated_at = now()
      WHERE ${userProfilesTable.userId} = ${userId}
    `);

    return { trialDays, trialEndsAt };
  });
}
