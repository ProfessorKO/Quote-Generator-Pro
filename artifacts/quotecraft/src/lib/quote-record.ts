import type {
  QuoteLineItem,
  QuoteSettings,
  QuoteRecordInput,
} from "@workspace/api-client-react";
import type { QuoteTotals } from "./pdf";

export const effectiveRate = (item: QuoteLineItem) =>
  item.unitPrice * (1 + (item.overtimePercent ?? 0) / 100);

export function computeTotals(
  lineItems: QuoteLineItem[],
  settings: QuoteSettings,
): QuoteTotals {
  let subtotal = 0;
  lineItems.forEach((item) => {
    subtotal += effectiveRate(item) * item.quantity;
  });
  const callOut = settings.hasCallOut ? settings.callOutFee : 0;
  const surcharge = settings.isPublicHoliday
    ? subtotal * (settings.publicHolidaySurchargePercent / 100)
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
  const { label, lineItems, settings, source, client } = params;
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
