import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

// Per-user, per-calendar-month (Australia/Sydney) usage counters for the free
// tier. `period` is "YYYY-MM"; a new month simply starts a fresh row, which
// gives the required monthly reset without any cron job.
export const usageCountersTable = pgTable(
  "usage_counters",
  {
    userId: text("user_id").notNull(),
    period: text("period").notNull(),
    newQuotes: integer("new_quotes").notNull().default(0),
    voiceEdits: integer("voice_edits").notNull().default(0),
    emailsSent: integer("emails_sent").notNull().default(0),
    pdfDownloads: integer("pdf_downloads").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.period] })],
);

// One row per fulfilled Stripe Checkout session for credit packs. The primary
// key on the session id makes fulfillment idempotent — confirming the same
// session twice cannot double-credit.
export const creditPurchasesTable = pgTable("credit_purchases", {
  stripeSessionId: text("stripe_session_id").primaryKey(),
  userId: text("user_id").notNull(),
  credits: integer("credits").notNull(),
  amountTotal: integer("amount_total"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UsageCounters = typeof usageCountersTable.$inferSelect;
export type CreditPurchase = typeof creditPurchasesTable.$inferSelect;
