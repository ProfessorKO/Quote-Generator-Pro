import { jsPDF } from "jspdf";
import type { QuoteLineItem, QuoteSettings } from "@workspace/api-client-react";
import { formatAbn, formatAcn } from "./format";

export interface PdfHeader {
  businessName: string;
  contactName: string;
  address: string;
  email: string;
  mobile?: string; // already display-formatted "+61-04 XXXX XXXX", omitted if blank
  abn?: string; // 11 digits, omitted if blank
  acn?: string; // 9 digits, omitted if blank
}

export interface QuoteTotals {
  subtotal: number;
  callOut: number;
  surcharge: number;
  gst: number;
  total: number;
}

const FOOTER_MESSAGE =
  "Thank you for your business! We are looking forward to hearing from you!";

// Bug #27: cap description length so a single item can't balloon the PDF.
export const MAX_DESCRIPTION_CHARS = 500;

const NAVY: [number, number, number] = [27, 44, 77];
const AMBER: [number, number, number] = [242, 147, 13];
const MUTED: [number, number, number] = [98, 109, 132];

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

const effectiveRate = (item: QuoteLineItem) =>
  item.unitPrice * (1 + (item.overtimePercent ?? 0) / 100);

export function buildPdf(params: {
  header: PdfHeader;
  clientLabel?: string;
  lineItems: QuoteLineItem[];
  settings: QuoteSettings;
  totals: QuoteTotals;
}): jsPDF {
  const { header, clientLabel, lineItems, settings, totals } = params;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  const right = pageWidth - marginX;
  let y = 56;

  // ---- Header block ----
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(header.businessName || "Your Business", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  y += 20;

  const headerLines: string[] = [];
  if (header.contactName) headerLines.push(header.contactName);
  if (header.address) headerLines.push(header.address);
  if (header.email) headerLines.push(header.email);
  if (header.mobile) headerLines.push(header.mobile);
  if (header.abn) headerLines.push(`ABN: ${formatAbn(header.abn)}`);
  if (header.acn) headerLines.push(`ACN: ${formatAcn(header.acn)}`);
  for (const line of headerLines) {
    doc.text(line, marginX, y);
    y += 14;
  }

  // Title + accent rule
  y += 10;
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(2);
  doc.line(marginX, y, right, y);
  y += 24;

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("QUOTE", marginX, y);

  if (clientLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(clientLabel, right, y, { align: "right" });
  }
  y += 22;

  // ---- Line items table ----
  const colQty = right - 200;
  const colRate = right - 110;
  const colTotal = right;
  const pageHeight = doc.internal.pageSize.getHeight();
  // Keep clear of the footer band.
  const bottomLimit = pageHeight - 110;
  const LINE_HEIGHT = 13;

  const drawTableHeader = () => {
    doc.setFillColor(...NAVY);
    doc.rect(marginX, y - 12, right - marginX, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DESCRIPTION", marginX + 8, y + 3);
    doc.text("QTY", colQty, y + 3, { align: "right" });
    doc.text("RATE", colRate, y + 3, { align: "right" });
    doc.text("AMOUNT", colTotal - 8, y + 3, { align: "right" });
    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
  };

  // Bug #27: when a row (or its remaining description lines) can't fit on the
  // current page, note the continuation and carry on atop a fresh page.
  const continueOnNextPage = () => {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Continued on next page...", marginX + 8, bottomLimit + 14);
    doc.addPage();
    y = 56;
    drawTableHeader();
  };

  drawTableHeader();

  lineItems.forEach((item, i) => {
    // Bug #27: truncate overlong descriptions with an ellipsis.
    let raw = (item.label || "Item").trim();
    if (raw.length > MAX_DESCRIPTION_CHARS) {
      raw = `${raw.slice(0, MAX_DESCRIPTION_CHARS)}...`;
    }
    const lines: string[] = doc.splitTextToSize(raw, colQty - marginX - 16);
    const rowHeight = Math.max(20, (lines.length - 1) * LINE_HEIGHT + 20);

    // Start the row on a new page if not even its first line fits.
    if (y + 9 > bottomLimit) continueOnNextPage();

    // Zebra stripe (only when the whole row fits on this page).
    if (i % 2 === 1 && y - 11 + rowHeight <= bottomLimit) {
      doc.setFillColor(244, 246, 249);
      doc.rect(marginX, y - 11, right - marginX, rowHeight, "F");
    }

    const rate = effectiveRate(item);
    const lineTotal = rate * item.quantity;
    doc.text(String(item.quantity), colQty, y + 3, { align: "right" });
    doc.text(money(rate), colRate, y + 3, { align: "right" });
    doc.text(money(lineTotal), colTotal - 8, y + 3, { align: "right" });

    // Bug #27: render every wrapped description line, splitting across pages
    // when a very long description exceeds the space remaining.
    let lineY = y + 3;
    for (const line of lines) {
      if (lineY > bottomLimit) {
        continueOnNextPage();
        lineY = y + 3;
      }
      doc.text(line, marginX + 8, lineY);
      lineY += LINE_HEIGHT;
    }
    y = lineY - LINE_HEIGHT + 17;
  });

  // ---- Totals ----
  // Keep the totals block together; move it to a fresh page if it can't fit.
  if (y + 130 > bottomLimit) {
    doc.addPage();
    y = 56;
  }
  y += 12;
  const labelX = colRate;
  const valueX = colTotal - 8;

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...(bold ? NAVY : MUTED));
    doc.text(label, labelX, y, { align: "right" });
    doc.setTextColor(...(bold ? NAVY : ([40, 40, 40] as [number, number, number])));
    doc.text(value, valueX, y, { align: "right" });
    y += bold ? 22 : 18;
  };

  totalRow("Subtotal", money(totals.subtotal));
  if (totals.callOut > 0) totalRow("Call-out fee", money(totals.callOut));
  if (totals.surcharge > 0)
    totalRow(
      `Public holiday surcharge (${settings.publicHolidaySurchargePercent}%)`,
      money(totals.surcharge),
    );
  if (settings.includeGst)
    totalRow(`GST (${Math.round(settings.gstRate * 100)}%)`, money(totals.gst));

  y += 4;
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(1);
  doc.line(labelX - 60, y - 6, valueX, y - 6);
  y += 8;
  totalRow("Total (incl. GST)", money(totals.total), true);

  // ---- Footer ----
  const footerY = doc.internal.pageSize.getHeight() - 48;
  doc.setDrawColor(230, 232, 236);
  doc.setLineWidth(1);
  doc.line(marginX, footerY - 16, right, footerY - 16);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(FOOTER_MESSAGE, pageWidth / 2, footerY, { align: "center" });

  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

/** Base64 (no data: prefix) for emailing as an attachment. */
export function pdfToBase64(doc: jsPDF): string {
  const dataUri = doc.output("datauristring");
  return dataUri.split(",")[1] ?? "";
}
