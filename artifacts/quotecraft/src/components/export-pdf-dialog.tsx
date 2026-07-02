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
import { MobileInput } from "@/components/mobile-input";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessProfile,
  useUpsertBusinessProfile,
  useCreateQuote,
  getListQuotesQueryKey,
  getGetBusinessProfileQueryKey,
  type QuoteLineItem,
  type QuoteSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { buildPdf, downloadPdf, type PdfHeader } from "@/lib/pdf";
import { buildQuoteRecord, computeTotals } from "@/lib/quote-record";
import {
  formatStoredMobile,
  formatMobileDisplay,
  mobileDigitsFromStored,
  mobileValidationError,
  addressValidationError,
  sanitizeAbn,
  isValidAbn,
  sanitizeAcn,
  isValidAcn,
  formatCurrency,
} from "@/lib/format";

interface ExportPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  lineItems: QuoteLineItem[];
  settings: QuoteSettings;
  onExported?: () => void;
}

export function ExportPdfDialog({
  open,
  onOpenChange,
  label,
  lineItems,
  settings,
  onExported,
}: ExportPdfDialogProps) {
  const qc = useQueryClient();
  const { user } = useUser();
  const { data: profile } = useGetBusinessProfile({
    query: { retry: false, queryKey: getGetBusinessProfileQueryKey() },
  });
  const createQuote = useCreateQuote();
  const upsertProfile = useUpsertBusinessProfile();

  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [abn, setAbn] = useState("");
  const [acn, setAcn] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // (Re)seed from profile + Clerk whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setContactName(user?.fullName ?? "");
    setEmail(user?.primaryEmailAddress?.emailAddress ?? "");
    setBusinessName(profile?.businessName ?? "");
    setMobile(mobileDigitsFromStored(profile?.mobile));
    setAddress(profile?.address ?? "");
    setAbn(sanitizeAbn(profile?.abn ?? ""));
    setAcn(sanitizeAcn(profile?.acn ?? ""));
    setErrors({});
  }, [open, profile, user]);

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
      case "contactName":
        return value.trim() ? null : "Contact name is required";
      case "businessName":
        return value.trim() ? null : "Business name is required";
      case "email":
        return value.trim() ? null : "Email is required";
      case "address":
        return addressValidationError(value);
      case "mobile":
        return mobileValidationError(value, true);
      case "abn":
        return value && !isValidAbn(value) ? "ABN must be 11 digits" : null;
      case "acn":
        return value && !isValidAcn(value) ? "ACN must be 9 digits" : null;
      default:
        return null;
    }
  };

  const validate = () => {
    const checks: Array<[string, string]> = [
      ["contactName", contactName],
      ["businessName", businessName],
      ["email", email],
      ["address", address],
      ["mobile", mobile],
      ["abn", abn],
      ["acn", acn],
    ];
    const e: Record<string, string> = {};
    for (const [field, value] of checks) {
      const msg = fieldError(field, value);
      if (msg) e[field] = msg;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Offer to persist export-time header edits back to the saved profile (§9.4).
  const promptSaveOverride = () => {
    if (!profile) return;
    const changed =
      businessName.trim() !== (profile.businessName ?? "") ||
      mobile !== mobileDigitsFromStored(profile.mobile) ||
      address.trim() !== (profile.address ?? "") ||
      abn !== sanitizeAbn(profile.abn ?? "") ||
      acn !== sanitizeAcn(profile.acn ?? "");
    if (!changed) return;
    toast("Save these details to your profile?", {
      duration: 8000,
      action: {
        label: "Save",
        onClick: () =>
          upsertProfile.mutate(
            {
              data: {
                businessName: businessName.trim(),
                mobile: formatStoredMobile(mobile),
                abn,
                acn: acn || null,
                address: address.trim(),
                marketingConsent: profile.marketingConsent,
              },
            },
            {
              onSuccess: () => {
                qc.invalidateQueries({
                  queryKey: getGetBusinessProfileQueryKey(),
                });
                toast.success("Profile updated");
              },
              onError: () => toast.error("Couldn't update profile"),
            },
          ),
      },
    });
  };

  const handleExport = () => {
    if (!validate()) return;

    const header: PdfHeader = {
      businessName: businessName.trim(),
      contactName: contactName.trim(),
      address: address.trim(),
      email: email.trim(),
      mobile: mobile ? formatMobileDisplay(mobile) : undefined,
      abn: abn || undefined,
      acn: acn || undefined,
    };
    const totals = computeTotals(lineItems, settings);
    const doc = buildPdf({ header, clientLabel: label, lineItems, settings, totals });
    const filename = `quote-${(label || "quotecraft")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}.pdf`;
    downloadPdf(doc, filename);

    // Download is a gated action → record the quote to history (§11).
    createQuote.mutate(
      {
        data: buildQuoteRecord({
          label: label || businessName,
          lineItems,
          settings,
          source: "download",
        }),
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        },
        onError: () =>
          toast.error("PDF downloaded, but couldn't add it to your history"),
      },
    );

    toast.success("PDF downloaded");
    onOpenChange(false);
    onExported?.();
    promptSaveOverride();
  };

  const total = computeTotals(lineItems, settings).total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] rounded-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Download branded PDF</DialogTitle>
          <DialogDescription>
            Pre-filled from your profile. Edit any field for this export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-contact">Contact name</Label>
            <Input
              id="pdf-contact"
              value={contactName}
              onChange={(e) => {
                setContactName(e.target.value);
                setFieldError("contactName", null);
              }}
              onBlur={(e) => {
                setContactName(e.target.value);
                setFieldError("contactName", fieldError("contactName", e.target.value));
              }}
            />
            {errors.contactName && (
              <p className="text-xs text-destructive">{errors.contactName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdf-business">Business name</Label>
            <Input
              id="pdf-business"
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                setFieldError("businessName", null);
              }}
              onBlur={(e) => {
                setBusinessName(e.target.value);
                setFieldError("businessName", fieldError("businessName", e.target.value));
              }}
            />
            {errors.businessName && (
              <p className="text-xs text-destructive">{errors.businessName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdf-email">Email</Label>
            <Input
              id="pdf-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldError("email", null);
              }}
              onBlur={(e) => {
                setEmail(e.target.value);
                setFieldError("email", fieldError("email", e.target.value));
              }}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdf-mobile">Mobile</Label>
            <MobileInput
              id="pdf-mobile"
              value={mobile}
              invalid={!!errors.mobile}
              onChange={(digits) => {
                setMobile(digits);
                setFieldError("mobile", null);
              }}
              onBlur={(digits) => {
                setMobile(digits);
                setFieldError("mobile", fieldError("mobile", digits));
              }}
            />
            {errors.mobile && (
              <p className="text-xs text-destructive">{errors.mobile}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdf-address">Address</Label>
            <Textarea
              id="pdf-address"
              rows={2}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setFieldError("address", null);
              }}
              onBlur={(e) => {
                setAddress(e.target.value);
                setFieldError("address", fieldError("address", e.target.value));
              }}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address}</p>
            )}
          </div>

          <div className="flex gap-3">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="pdf-abn">
                ABN{" "}
                <span className="text-muted-foreground font-normal">(opt)</span>
              </Label>
              <Input
                id="pdf-abn"
                inputMode="numeric"
                value={abn}
                onChange={(e) => {
                  setAbn(sanitizeAbn(e.target.value));
                  setFieldError("abn", null);
                }}
                onBlur={(e) => {
                  const v = sanitizeAbn(e.target.value);
                  setAbn(v);
                  setFieldError("abn", fieldError("abn", v));
                }}
              />
              {errors.abn && (
                <p className="text-xs text-destructive">{errors.abn}</p>
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="pdf-acn">
                ACN{" "}
                <span className="text-muted-foreground font-normal">(opt)</span>
              </Label>
              <Input
                id="pdf-acn"
                inputMode="numeric"
                value={acn}
                onChange={(e) => {
                  setAcn(sanitizeAcn(e.target.value));
                  setFieldError("acn", null);
                }}
                onBlur={(e) => {
                  const v = sanitizeAcn(e.target.value);
                  setAcn(v);
                  setFieldError("acn", fieldError("acn", v));
                }}
              />
              {errors.acn && (
                <p className="text-xs text-destructive">{errors.acn}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button onClick={handleExport} className="w-full sm:w-auto">
            <Download className="w-4 h-4" />
            Download ({formatCurrency(total)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
