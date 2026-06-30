import { pgTable, serial, text, jsonb, doublePrecision, timestamp, index } from "drizzle-orm/pg-core";
import type { LineItem, QuoteSettings } from "./templates";

export const quotesTable = pgTable(
  "quotes",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    label: text("label").notNull(),
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    clientAddress: text("client_address"),
    clientSuburb: text("client_suburb"),
    lineItems: jsonb("line_items").notNull().$type<LineItem[]>(),
    settings: jsonb("settings").notNull().$type<QuoteSettings>(),
    total: doublePrecision("total").notNull(),
    source: text("source").notNull().default("save"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
  },
  (table) => [index("quotes_user_id_idx").on(table.userId)],
);

export type Quote = typeof quotesTable.$inferSelect;
