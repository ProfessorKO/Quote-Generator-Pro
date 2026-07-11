import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
