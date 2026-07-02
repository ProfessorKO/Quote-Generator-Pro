import { useState, useEffect, useRef } from "react";
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
  formatMobileDisplay,
  mobileDigitsFromStored,
  formatCurrency,
} from "@/lib/format";
import { useFormDraft } from "@/hooks/use-form-draft";
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
  // When a draft was restored for this open-cycle, don't let the async
  // template/profile load re-seed subject/body over the restored values.
  const draftRestoredRef = useRef(false);

  const total = computeTotals(lineItems, settings).total;
  const businessName = profile?.businessName ?? "";

  // Seed subject/body from the saved template (or defaults) with placeholders
  // resolved against the current client + quote whenever the dialog opens.
  useEffect(() => {
    if (!open) {
      draftRestoredRef.current = false;
      return;
    }
    if (draftRestoredRef.current) return;
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

  // Draft autosave (Bug #22). Declared after the seeding effect so a saved
  // draft restores over the template-seeded subject/body.
  const { clearDraft } = useFormDraft("quotecraft:draft:email-quote", {
    active: open,
    data: { clientName, clientEmail, clientAddress, clientSuburb, subject, body },
    isEmpty: (d) =>
      !d.clientName && !d.clientEmail && !d.clientAddress && !d.clientSuburb,
    onRestore: (d) => {
      draftRestoredRef.current = true;
      setClientName(d.clientName ?? "");
      setClientEmail(d.clientEmail ?? "");
      setClientAddress(d.clientAddress ?? "");
      setClientSuburb(d.clientSuburb ?? "");
      if (d.subject) setSubject(d.subject);
      if (d.body) setBody(d.body);
    },
  });

  const setFieldError = (field: string, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  // Field-level checks, run on blur (with the live DOM value so browser
  // autofill is validated correctly) and on submit. Typing clears the
  // field's error (Bug #19).
  const fieldError = (field: string, value: string): string | null => {
    switch (field) {
      case "clientName":
        return value.trim() ? null : "Client name is required";
      case "clientEmail":
        return value.trim() && /^\S+@\S+\.\S+$/.test(value.trim())
          ? null
          : "A valid client email is required";
      case "subject":
        return value.trim() ? null : "Subject is required";
      case "body":
        return value.trim() ? null : "Message is required";
      default:
        return null;
    }
  };

  // Read the live DOM values at submit. Browser address autocomplete (and some
  // password managers) can inject values without firing change/blur events, so
  // trusting React state alone drops autofilled fields (Bug #19). Reading the
  // inputs directly captures whatever the user actually sees.
  const collectValues = () => {
    const domVal = (id: string, fallback: string) => {
      const el = document.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      return el ? el.value : fallback;
    };
    const values = {
      clientName: domVal("cl-name", clientName),
      clientEmail: domVal("cl-email", clientEmail),
      clientAddress: domVal("cl-address", clientAddress),
      clientSuburb: domVal("cl-suburb", clientSuburb),
      subject: domVal("cl-subject", subject),
      body: domVal("cl-body", body),
    };
    // Sync state so the display stays consistent with what we submit.
    setClientName(values.clientName);
    setClientEmail(values.clientEmail);
    setClientAddress(values.clientAddress);
    setClientSuburb(values.clientSuburb);
    setSubject(values.subject);
    setBody(values.body);
    return values;
  };

  const validate = (values: {
    clientName: string;
    clientEmail: string;
    subject: string;
    body: string;
  }) => {
    const checks: Array<[string, string]> = [
      ["clientName", values.clientName],
      ["clientEmail", values.clientEmail],
      ["subject", values.subject],
      ["body", values.body],
    ];
    const e: Record<string, string> = {};
    for (const [field, value] of checks) {
      const msg = fieldError(field, value);
      if (msg) e[field] = msg;
    }
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
        ? formatMobileDisplay(mobileDigitsFromStored(profile.mobile))
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
    const values = collectValues();
    if (!validate(values)) return;

    const client = {
      clientName: values.clientName.trim(),
      clientEmail: values.clientEmail.trim(),
      clientAddress: values.clientAddress.trim() || null,
      clientSuburb: values.clientSuburb.trim() || null,
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
                clearDraft();
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
              onChange={(e) => {
                setClientName(e.target.value);
                setFieldError("clientName", null);
              }}
              onBlur={(e) => {
                setClientName(e.target.value);
                setFieldError("clientName", fieldError("clientName", e.target.value));
              }}
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
              onChange={(e) => {
                setClientEmail(e.target.value);
                setFieldError("clientEmail", null);
              }}
              onBlur={(e) => {
                setClientEmail(e.target.value);
                setFieldError("clientEmail", fieldError("clientEmail", e.target.value));
              }}
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
                onBlur={(e) => setClientAddress(e.target.value)}
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
                onBlur={(e) => setClientSuburb(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-subject">Subject</Label>
            <Input
              id="cl-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setFieldError("subject", null);
              }}
              onBlur={(e) => {
                setSubject(e.target.value);
                setFieldError("subject", fieldError("subject", e.target.value));
              }}
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
              onChange={(e) => {
                setBody(e.target.value);
                setFieldError("body", null);
              }}
              onBlur={(e) => {
                setBody(e.target.value);
                setFieldError("body", fieldError("body", e.target.value));
              }}
            />
            {errors.body && (
              <p className="text-xs text-destructive">{errors.body}</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              clearDraft();
              onOpenChange(false);
            }}
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
