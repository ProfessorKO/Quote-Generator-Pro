import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// One row per registered account, synced from Clerk (the auth provider owns
// identity; this table mirrors it so admin views can join users to their
// business data with plain SQL). Marketing consent lives here — it belongs to
// the person, not to any one of their businesses. Timestamps are stored in
// UTC (timestamptz) and rendered in AEST by the UI.
export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  // How the account was created: "google" | "email" (extensible for future
  // providers), as reported by Clerk.
  signupMethod: text("signup_method"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  // Clerk account creation time.
  registeredAt: timestamp("registered_at", { withTimezone: true }),
  // Set when the account no longer exists in Clerk (deleted/closed).
  closedAt: timestamp("closed_at", { withTimezone: true }),
  // Stripe references — the actual customer/subscription records live in
  // Stripe (mirrored into the stripe.* schema by stripe-replit-sync).
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // Denormalised subscription state (#43). Stripe remains the source of
  // truth; these columns mirror it so plain SQL/admin views can see the plan
  // without joining the stripe.* schema. Kept in sync on checkout confirm,
  // cancel, undo-cancel, and reconciled whenever billing status is read.
  // plan: "free" | "paid"
  plan: text("plan").notNull().default("free"),
  // subscriptionStatus: "never" (no subscription yet) | "active" | "cancelled"
  subscriptionStatus: text("subscription_status").notNull().default("never"),
  // Pay-as-you-go credit balance. 1 credit = 1 action (new quote, voice
  // edit, email, or PDF download). Credits never expire and are consumed
  // before free-tier limits are applied.
  credits: integer("credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
