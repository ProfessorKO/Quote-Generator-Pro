import { pgTable, serial, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("business_profiles_user_id_unique").on(table.userId)],
);

export type BusinessProfile = typeof businessProfilesTable.$inferSelect;
