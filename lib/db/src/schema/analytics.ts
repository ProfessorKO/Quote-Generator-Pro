import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  jsonb,
  date,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// The five funnel steps we track from landing to sign-up. Kept as a
// text + CHECK constraint (not a native pg enum) so adding a step later is a
// one-line migration. The same closed set is enforced in the OpenAPI spec.
export const FUNNEL_EVENT_TYPES = [
  "landing_view",
  "try_it_click",
  "quote_created",
  "gated_action",
  "signup_completed",
] as const;
export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

// One row per funnel event. visitorId is a random client-generated id
// (localStorage) so distinct people can be told apart without storing any
// personal data; userId is attached server-side once the visitor signs up,
// linking the anonymous journey to the account it converted into.
export const funnelEventsTable = pgTable(
  "funnel_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(),
    visitorId: text("visitor_id").notNull(),
    // Clerk user id; null until the visitor signs up.
    userId: text("user_id"),
    // Structured extras (e.g. which gated action: pdf/email/save_template).
    metadata: jsonb("metadata").$type<{ action?: "pdf" | "email" | "save_template" } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("funnel_events_type_created_idx").on(t.eventType, t.createdAt),
    index("funnel_events_visitor_idx").on(t.visitorId),
    check(
      "funnel_events_event_type_check",
      sql`${t.eventType} in ('landing_view', 'try_it_click', 'quote_created', 'gated_action', 'signup_completed')`,
    ),
  ],
);

// Signed-out visitors get 3 free AI actions (quote generations + voice edits,
// combined) per Sydney calendar day. Persisted in the DB — NOT in memory —
// because autoscale restarts would otherwise reset the counter and hand out
// extra free calls. Key is "v:<visitorId>" or "ip:<ip>" when no visitor id
// was provided. Rows are tiny and keyed by day, safe to prune any time.
export const anonDailyUsageTable = pgTable(
  "anon_daily_usage",
  {
    visitorKey: text("visitor_key").notNull(),
    usageDate: date("usage_date", { mode: "string" }).notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.visitorKey, t.usageDate] })],
);

export type FunnelEvent = typeof funnelEventsTable.$inferSelect;
export type AnonDailyUsage = typeof anonDailyUsageTable.$inferSelect;
