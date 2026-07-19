import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { QuoteRecord, EmailRecord } from "@workspace/api-client-react";
import { computeTotals, effectiveRate } from "@/lib/quote-record";
import { formatCurrency } from "@/lib/format";

const sourceLabel: Record<string, string> = {
  save: "Saved",
  download: "Generated",
  email: "Emailed",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export function QuoteDetailDialog({
  quote,
  onOpenChange,
}: {
  quote: QuoteRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!quote) return null;
  const totals = computeTotals(quote.lineItems, quote.settings);
  const s = quote.settings;

  return (
    <Dialog open={!!quote} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] rounded-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {quote.label}
            <Badge variant="secondary" className="font-normal">
              {sourceLabel[quote.source] ?? quote.source}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-xs text-muted-foreground">
            Created {format(new Date(quote.createdAt), "d MMM yyyy, h:mma")}
            {quote.sentAt &&
              ` · Sent ${format(new Date(quote.sentAt), "d MMM yyyy")}`}
          </p>

          {(quote.clientName || quote.clientEmail || quote.clientSuburb) && (
            <div className="rounded-lg bg-muted/40 p-3 space-y-1">
              {quote.clientName && <Row label="Client" value={quote.clientName} />}
              {quote.clientEmail && (
                <Row label="Email" value={quote.clientEmail} />
              )}
              {quote.clientSuburb && (
                <Row label="Suburb" value={quote.clientSuburb} />
              )}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-primary">Line items</h4>
            {quote.lineItems.map((item) => (
              <div
                key={item.id}
                className="flex justify-between text-sm border-b border-border/50 pb-1.5"
              >
                <span className="truncate pr-2">
                  {item.label}{" "}
                  <span className="text-muted-foreground">
                    × {item.quantity}
                  </span>
                </span>
                <span className="font-mono">
                  {formatCurrency(effectiveRate(item) * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 rounded-lg bg-primary/5 p-3">
            <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
            {totals.callOut > 0 && (
              <Row label="Call-out fee" value={formatCurrency(totals.callOut)} />
            )}
            {totals.surcharge > 0 && (
              <Row
                label={`Surcharge (${s.publicHolidaySurchargePercent}%)`}
                value={formatCurrency(totals.surcharge)}
              />
            )}
            {s.includeGst && (
              <Row
                label={`GST (${Math.round(s.gstRate * 100)}%)`}
                value={formatCurrency(totals.gst)}
              />
            )}
            <div className="flex justify-between pt-1.5 border-t border-border">
              <span className="font-bold">Total</span>
              <span className="font-bold text-primary">
                {formatCurrency(totals.total)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmailDetailDialog({
  record,
  onOpenChange,
}: {
  record: EmailRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!record) return null;

  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] rounded-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {record.subject}
            <Badge
              variant={record.status === "sent" ? "secondary" : "destructive"}
              className="font-normal capitalize"
            >
              {record.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-xs text-muted-foreground">
            Sent {format(new Date(record.sentAt), "d MMM yyyy, h:mma")}
          </p>

          <div className="rounded-lg bg-muted/40 p-3 space-y-1">
            <Row label="Client" value={record.clientName} />
            <Row label="Email" value={record.clientEmail} />
            {record.clientSuburb && (
              <Row label="Suburb" value={record.clientSuburb} />
            )}
          </div>

          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold text-primary">Message</h4>
            <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
              {record.body}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
