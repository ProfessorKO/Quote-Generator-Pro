import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessProfile,
  useGetEmailTemplate,
  useCreateQuote,
  useSendQuoteEmail,
  getGetBusinessProfileQueryKey,
  getGetEmailTemplateQueryKey,
  getListQuotesQueryKey,
  getListEmailRecordsQueryKey,
  type QuoteLineItem,
  type QuoteSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { buildPdf, pdfToBase64, type PdfHeader } from "@/lib/pdf";
import { buildQuoteRecord, computeTotals } from "@/lib/quote-record";
import {
  formatStoredMobile,
  mobileDigitsFromStored,
  formatCurrency,
} from "@/lib/format";
import {
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_BODY,
  applyEmailPlaceholders,
} from "@/lib/email-template";

interface EmailQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  lineItems: QuoteLineItem[];
  settings: QuoteSettings;
  onSent?: () => void;
}

export function EmailQuoteDialog({
  open,
  onOpenChange,
  label,
  lineItems,
  settings,
  onSent,
}: EmailQuoteDialogProps) {
  const qc = useQueryClient();
  const { user } = useUser();
  const { data: profile } = useGetBusinessProfile({
    query: { retry: false, queryKey: getGetBusinessProfileQueryKey() },
  });
  const { data: template } = useGetEmailTemplate({
    query: { retry: false, queryKey: getGetEmailTemplateQueryKey() },
  });
  const createQuote = useCreateQuote();
  const sendEmail = useSendQuoteEmail();

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientSuburb, setClientSuburb] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = computeTotals(lineItems, settings).total;
  const businessName = profile?.businessName ?? "";

  // Seed subject/body from the saved template (or defaults) with placeholders
  // resolved against the current client + quote whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    const values = {
      clientName,
      businessName,
      quoteTotal: formatCurrency(total),
    };
    setSubject(
      applyEmailPlaceholders(template?.subject ?? DEFAULT_EMAIL_SUBJECT, values),
    );
    setBody(applyEmailPlaceholders(template?.body ?? DEFAULT_EMAIL_BODY, values));
    setErrors({});
    // Intentionally seed once per open; further edits are user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template, businessName]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clientName.trim()) e.clientName = "Client name is required";
    if (!clientEmail.trim() || !/^\S+@\S+\.\S+$/.test(clientEmail))
      e.clientEmail = "A valid client email is required";
    if (!subject.trim()) e.subject = "Subject is required";
    if (!body.trim()) e.body = "Message is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildAttachment = (): { base64: string; filename: string } => {
    const header: PdfHeader = {
      businessName,
      contactName: user?.fullName ?? "",
      address: profile?.address ?? "",
      email: user?.primaryEmailAddress?.emailAddress ?? "",
      mobile: profile?.mobile
        ? formatStoredMobile(mobileDigitsFromStored(profile.mobile))
        : undefined,
      abn: profile?.abn || undefined,
      acn: profile?.acn || undefined,
    };
    const totals = computeTotals(lineItems, settings);
    const doc = buildPdf({
      header,
      clientLabel: clientName.trim() || label,
      lineItems,
      settings,
      totals,
    });
    const filename = `quote-${(clientName || label || "quotecraft")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}.pdf`;
    return { base64: pdfToBase64(doc), filename };
  };

  const handleSend = () => {
    if (!validate()) return;

    const client = {
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientAddress: clientAddress.trim() || null,
      clientSuburb: clientSuburb.trim() || null,
    };

    // Email is a gated action → first record the quote, then send with its id so
    // the server can stamp sentAt and link the email record (§6.4, §11).
    createQuote.mutate(
      {
        data: buildQuoteRecord({
          label: label || clientName,
          lineItems,
          settings,
          source: "email",
          client,
        }),
      },
      {
        onSuccess: (quote) => {
          qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          const { base64, filename } = buildAttachment();
          sendEmail.mutate(
            {
              data: {
                quoteId: quote.id,
                clientName: client.clientName,
                clientEmail: client.clientEmail,
                clientAddress: client.clientAddress,
                clientSuburb: client.clientSuburb,
                subject: subject.trim(),
                body,
                attachmentBase64: base64,
                attachmentFilename: filename,
              },
            },
            {
              onSuccess: () => {
                qc.invalidateQueries({
                  queryKey: getListEmailRecordsQueryKey(),
                });
                qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
                toast.success(`Quote emailed to ${client.clientName}`);
                onOpenChange(false);
                onSent?.();
              },
              onError: () =>
                toast.error("Couldn't send the email. Please try again."),
            },
          );
        },
        onError: () => toast.error("Couldn't save the quote. Please try again."),
      },
    );
  };

  const pending = createQuote.isPending || sendEmail.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] rounded-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email quote to client</DialogTitle>
          <DialogDescription>
            The branded PDF is attached automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">Client name</Label>
            <Input
              id="cl-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
            {errors.clientName && (
              <p className="text-xs text-destructive">{errors.clientName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-email">Client email</Label>
            <Input
              id="cl-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
            {errors.clientEmail && (
              <p className="text-xs text-destructive">{errors.clientEmail}</p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="cl-address">
                Address{" "}
                <span className="text-muted-foreground font-normal">(opt)</span>
              </Label>
              <Input
                id="cl-address"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="cl-suburb">
                Suburb{" "}
                <span className="text-muted-foreground font-normal">(opt)</span>
              </Label>
              <Input
                id="cl-suburb"
                value={clientSuburb}
                onChange={(e) => setClientSuburb(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-subject">Subject</Label>
            <Input
              id="cl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            {errors.subject && (
              <p className="text-xs text-destructive">{errors.subject}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-body">Message</Label>
            <Textarea
              id="cl-body"
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {errors.body && (
              <p className="text-xs text-destructive">{errors.body}</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
