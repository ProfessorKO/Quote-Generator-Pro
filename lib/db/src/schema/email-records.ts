import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const emailRecordsTable = pgTable(
  "email_records",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    quoteId: integer("quote_id"),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    clientSuburb: text("client_suburb"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("sent"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => [index("email_records_user_id_idx").on(table.userId)],
);

export type EmailRecord = typeof emailRecordsTable.$inferSelect;
