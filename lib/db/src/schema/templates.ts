import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  businessDescription: text("business_description").notNull(),
  lineItems: jsonb("line_items").notNull().$type<LineItem[]>(),
  settings: jsonb("settings").notNull().$type<QuoteSettings>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;

export interface LineItem {
  id: string;
  label: string;
  description?: string | null;
  unit: string;
  unitPrice: number;
  quantity: number;
  voiceKey: string;
}

export interface QuoteSettings {
  includeGst: boolean;
  gstRate: number;
  callOutFee: number;
  publicHolidaySurchargePercent: number;
  isPublicHoliday: boolean;
  hasCallOut: boolean;
}
