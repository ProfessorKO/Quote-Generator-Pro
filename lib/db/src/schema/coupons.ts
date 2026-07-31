import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";

// Promotional coupon codes (lean v1, July 2026): free_trial type only — a
// valid code grants Pro access for `freeTrialDays` days WITHOUT Stripe (the
// trial lives on user_profiles.trial_ends_at). No percentage/fixed discounts
// and no admin portal UI; codes are created via the protected
// POST /api/admin/coupons endpoint (or direct SQL in dev).
export const couponsTable = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Codes are matched case-insensitively (stored as entered, compared upper).
  code: text("code").notNull().unique(),
  description: text("description"),
  // 'free_trial' is the only supported type in v1; the column exists so
  // percentage/fixed can be added later without a migration.
  discountType: text("discount_type").notNull().default("free_trial"),
  freeTrialDays: integer("free_trial_days").notNull(),
  // NULL = unlimited redemptions.
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  // Clerk user id (TEXT). NULL = public coupon, anyone can redeem.
  userId: text("user_id"),
  // NULL = never expires.
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  // Clerk user id of the admin who created it (null for SQL inserts).
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// One row per (coupon, user) redemption. The unique constraint is what makes
// "no double redemption per user" atomic — the insert either lands or
// conflicts, regardless of concurrent requests.
export const couponRedemptionsTable = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => couponsTable.id),
    userId: text("user_id").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // The trial end this redemption granted (audit trail).
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.couponId, table.userId)],
);

export type Coupon = typeof couponsTable.$inferSelect;
export type CouponRedemption = typeof couponRedemptionsTable.$inferSelect;
