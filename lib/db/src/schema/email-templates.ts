import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const emailTemplatesTable = pgTable(
  "email_templates",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("email_templates_user_id_unique").on(table.userId)],
);

export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;
