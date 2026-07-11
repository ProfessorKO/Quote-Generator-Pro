import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

// A user may own one or more businesses (1:many via user_id — the previous
// unique constraint was dropped deliberately). `id` is the business's own
// primary key. The user's identity (email, marketing consent) lives in
// user_profiles; nothing user-level is duplicated here.
export const businessProfilesTable = pgTable(
  "business_profiles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    businessName: text("business_name").notNull(),
    mobile: text("mobile").notNull(),
    abn: text("abn").notNull(),
    acn: text("acn"),
    address: text("address").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("business_profiles_user_id_idx").on(table.userId)],
);

export type BusinessProfile = typeof businessProfilesTable.$inferSelect;
