import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessProfile,
  useGetEmailTemplate,
  useSendQuoteEmail,
  useGetNextQuoteSequence,
  getGetBusinessProfileQueryKey,
  getGetEmailTemplateQueryKey,
  getListQuotesQueryKey,
  getListEmailRecordsQueryKey,
  getGetNextQuoteSequenceQueryKey,
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
  sanitizePdfFilename,
  filenameValidationError,
  buildEmailFilename,
  MAX_FILENAME_CHARS,
} from "@/lib/filename";
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
  const sendEmail = useSendQuoteEmail();

  // Per-user, per-year sequence number for the filename convention (#28).
  const { data: nextSeq } = useGetNextQuoteSequence({
    query: { enabled: open, queryKey: getGetNextQuoteSequenceQueryKey() },
  });

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientSuburb, setClientSuburb] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [filename, setFilename] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Once the user edits the filename, stop auto-regenerating it (#28).
  const filenameDirtyRef = useRef(false);
  // When a draft was restored for this open-cycle, don't let the async
  // template/profile load re-seed subject/body over the restored values.
  const draftRestoredRef = useRef(false);

  const [, setLocation] = useLocation();
  const total = computeTotals(lineItems, settings).total;
  const businessName = profile?.businessName ?? "";
  const ownEmail =
    user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? "";

  // Profile-complete gate (Bug #23): a quote can only be emailed once the
  // business profile has the details that appear on the branded PDF.
  const profileMissing: string[] = [];
  if (!profile?.businessName?.trim()) profileMissing.push("business name");
  if (!profile?.mobile?.trim()) profileMissing.push("mobile");
  if (!profile?.abn?.trim()) profileMissing.push("ABN");
  if (!profile?.address?.trim()) profileMissing.push("address");
  const profileIncomplete = profileMissing.length > 0;

  // Seed subject/body from the saved template (or defaults) with placeholders
  // resolved against the current client + quote whenever the dialog opens.
  useEffect(() => {
    if (!open) {
      draftRestoredRef.current = false;
      filenameDirtyRef.current = false;
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

  // Pre-populate the filename per convention until the user edits it (#28):
  // Quote_{BusinessName}_{ClientName}_###
  useEffect(() => {
    if (!open || filenameDirtyRef.current) return;
    setFilename(
      buildEmailFilename(
        businessName.trim(),
        clientName.trim(),
        nextSeq?.formatted ?? "001",
      ),
    );
  }, [open, businessName, clientName, nextSeq]);

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
      case "clientEmail": {
        const v = value.trim();
        if (!v || !/^\S+@\S+\.\S+$/.test(v))
          return "A valid client email is required";
        // Self-email guard (Bug #20): don't email a quote to your own address.
        if (ownEmail && v.toLowerCase() === ownEmail)
          return "This is your own email address — enter your client's email instead.";
        return null;
      }
      case "subject":
        return value.trim() ? null : "Subject is required";
      case "body":
        return value.trim() ? null : "Message is required";
      case "filename":
        return filenameValidationError(value);
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
      filename: domVal("cl-filename", filename),
    };
    // Sync state so the display stays consistent with what we submit.
    setClientName(values.clientName);
    setClientEmail(values.clientEmail);
    setClientAddress(values.clientAddress);
    setClientSuburb(values.clientSuburb);
    setSubject(values.subject);
    setBody(values.body);
    setFilename(values.filename);
    return values;
  };

  const validate = (values: {
    clientName: string;
    clientEmail: string;
    subject: string;
    body: string;
    filename: string;
  }) => {
    const checks: Array<[string, string]> = [
      ["clientName", values.clientName],
      ["clientEmail", values.clientEmail],
      ["subject", values.subject],
      ["body", values.body],
      ["filename", values.filename],
    ];
    const e: Record<string, string> = {};
    for (const [field, value] of checks) {
      const msg = fieldError(field, value);
      if (msg) e[field] = msg;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildAttachment = (
    clientLabel: string,
    filenameInput: string,
  ): { base64: string; filename: string } => {
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
      clientLabel: clientLabel || label,
      lineItems,
      settings,
      totals,
    });
    // Editable, sanitized filename (#28).
    return {
      base64: pdfToBase64(doc),
      filename: `${sanitizePdfFilename(filenameInput)}.pdf`,
    };
  };

  const handleSend = () => {
    // Profile-complete gate (Bug #23): block sending until the branded-PDF
    // details exist, and point the user to Settings.
    if (profileIncomplete) {
      toast.error(`Complete your business profile first (${profileMissing.join(", ")})`);
      onOpenChange(false);
      setLocation("/settings");
      return;
    }

    const values = collectValues();
    if (!validate(values)) return;

    const client = {
      clientName: values.clientName.trim(),
      clientEmail: values.clientEmail.trim(),
      clientAddress: values.clientAddress.trim() || null,
      clientSuburb: values.clientSuburb.trim() || null,
    };

    const { base64, filename: attachmentFilename } = buildAttachment(
      client.clientName,
      values.filename,
    );

    // History is recorded only after a successful send (Bug #21): we hand the
    // quote to the server, which creates it + the email record atomically once
    // Resend confirms delivery. A failed send persists nothing.
    sendEmail.mutate(
      {
        data: {
          quote: buildQuoteRecord({
            label: label || client.clientName,
            lineItems,
            settings,
            source: "email",
            client,
          }),
          clientName: client.clientName,
          clientEmail: client.clientEmail,
          clientAddress: client.clientAddress,
          clientSuburb: client.clientSuburb,
          subject: values.subject.trim(),
          body: values.body,
          attachmentBase64: base64,
          attachmentFilename,
        },
      },
      {
        onSuccess: () => {
          clearDraft();
          qc.invalidateQueries({ queryKey: getListEmailRecordsQueryKey() });
          qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetNextQuoteSequenceQueryKey() });
          toast.success(`Quote emailed to ${client.clientName}`);
          onOpenChange(false);
          onSent?.();
        },
        // Surface the server's mapped, client-safe reason (Bug #24). The API
        // client throws an ApiError whose parsed JSON payload lives on `.data`.
        onError: (err: unknown) => {
          const data = (err as { data?: { error?: string } } | null)?.data;
          const msg =
            typeof data?.error === "string" && data.error.trim()
              ? data.error
              : "Couldn't send the email. Please try again.";
          toast.error(msg);
        },
      },
    );
  };

  const pending = sendEmail.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] rounded-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email quote to client</DialogTitle>
          <DialogDescription>
            The branded PDF is attached automatically.
          </DialogDescription>
        </DialogHeader>

        {profileIncomplete && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-destructive font-medium">
                Complete your business profile to email quotes.
              </p>
              <p className="text-muted-foreground text-xs">
                Missing: {profileMissing.join(", ")}. These appear on the branded
                PDF.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 mt-0.5"
                onClick={() => {
                  onOpenChange(false);
                  setLocation("/settings");
                }}
              >
                Go to Settings
              </Button>
            </div>
          </div>
        )}

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

          {/* Editable attachment filename (#28) */}
          <div className="space-y-1.5">
            <Label htmlFor="cl-filename">Attachment filename</Label>
            <Input
              id="cl-filename"
              value={filename}
              maxLength={MAX_FILENAME_CHARS}
              onChange={(e) => {
                filenameDirtyRef.current = true;
                setFilename(e.target.value);
                setFieldError("filename", null);
              }}
              onBlur={(e) => {
                setFilename(e.target.value);
                setFieldError("filename", fieldError("filename", e.target.value));
              }}
            />
            {errors.filename ? (
              <p className="text-xs text-destructive">{errors.filename}</p>
            ) : (
              sanitizePdfFilename(filename) && (
                <p className="text-xs text-muted-foreground">
                  Will attach as{" "}
                  <span className="font-medium text-foreground">
                    {sanitizePdfFilename(filename)}.pdf
                  </span>
                </p>
              )
            )}
            <p className="text-xs text-muted-foreground">
              Suggested format: Quote_BusinessName_ClientName_###
            </p>
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
            disabled={pending || profileIncomplete}
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
