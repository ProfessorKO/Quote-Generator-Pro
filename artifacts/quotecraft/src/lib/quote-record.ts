import type {
  QuoteLineItem,
  QuoteSettings,
  QuoteRecordInput,
} from "@workspace/api-client-react";
import type { QuoteTotals } from "./pdf";

/**
 * Legacy saved data (older templates, quote history, drafts) stored the
 * surcharge as a fraction (0.3 meaning 30%). Current data stores a whole
 * percent (30). Any value between 0 and 1 is treated as a legacy fraction.
 */
export function normalizeSettings(s: QuoteSettings): QuoteSettings {
  const pct = s.publicHolidaySurchargePercent;
  if (pct > 0 && pct < 1) {
    return { ...s, publicHolidaySurchargePercent: Math.round(pct * 10000) / 100 };
  }
  return s;
}

export const effectiveRate = (item: QuoteLineItem) =>
  item.unitPrice * (1 + (item.overtimePercent ?? 0) / 100);

export function computeTotals(
  lineItems: QuoteLineItem[],
  rawSettings: QuoteSettings,
): QuoteTotals {
  const settings = normalizeSettings(rawSettings);
  let subtotal = 0;
  lineItems.forEach((item) => {
    subtotal += effectiveRate(item) * item.quantity;
  });
  const callOut = settings.hasCallOut ? settings.callOutFee : 0;
  // Surcharge applies to subtotal + call-out fee (the call-out is surchargeable work).
  const surcharge = settings.isPublicHoliday
    ? (subtotal + callOut) * (settings.publicHolidaySurchargePercent / 100)
    : 0;
  const taxableAmount = subtotal + callOut + surcharge;
  const gst = settings.includeGst ? taxableAmount * settings.gstRate : 0;
  const total = taxableAmount + gst;
  return { subtotal, callOut, surcharge, gst, total };
}

export interface ClientDetails {
  clientName?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  clientSuburb?: string | null;
}

export function buildQuoteRecord(params: {
  label: string;
  lineItems: QuoteLineItem[];
  settings: QuoteSettings;
  source: "save" | "download" | "email";
  client?: ClientDetails;
}): QuoteRecordInput {
  const { label, lineItems, source, client } = params;
  // Persist normalized settings so a legacy fraction can never be written back.
  const settings = normalizeSettings(params.settings);
  const totals = computeTotals(lineItems, settings);
  return {
    label: label.trim() || "Untitled quote",
    lineItems,
    settings,
    total: totals.total,
    source,
    clientName: client?.clientName ?? null,
    clientEmail: client?.clientEmail ?? null,
    clientAddress: client?.clientAddress ?? null,
    clientSuburb: client?.clientSuburb ?? null,
  };
}
