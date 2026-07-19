import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MobileInput } from "@/components/mobile-input";
import { useFormDraft } from "@/hooks/use-form-draft";
import {
  useUpsertBusinessProfile,
  getGetBusinessProfileQueryKey,
  type BusinessProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatStoredMobile,
  mobileDigitsFromStored,
  mobileValidationError,
  addressValidationError,
  sanitizeAbn,
  isValidAbn,
  sanitizeAcn,
  isValidAcn,
} from "@/lib/format";

interface BusinessProfileFormProps {
  initial?: BusinessProfile | null;
  submitLabel: string;
  onSaved?: (profile: BusinessProfile) => void;
}

interface ProfileDraft {
  businessName: string;
  mobile: string;
  abn: string;
  acn: string;
  address: string;
  marketingConsent: boolean;
}

export function BusinessProfileForm({
  initial,
  submitLabel,
  onSaved,
}: BusinessProfileFormProps) {
  const qc = useQueryClient();
  const upsert = useUpsertBusinessProfile();

  const [businessName, setBusinessName] = useState(initial?.businessName ?? "");
  const [mobile, setMobile] = useState(mobileDigitsFromStored(initial?.mobile));
  const [abn, setAbn] = useState(sanitizeAbn(initial?.abn ?? ""));
  const [acn, setAcn] = useState(sanitizeAcn(initial?.acn ?? ""));
  const [address, setAddress] = useState(initial?.address ?? "");
  const [marketingConsent, setMarketingConsent] = useState(
    initial?.marketingConsent ?? false,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { clearDraft } = useFormDraft<ProfileDraft>(
    "quotecraft:draft:business-profile",
    {
      // Never restore a draft older than the saved profile (stale drafts must
      // not override fresh server data in Settings).
      ignoreBefore: initial?.updatedAt ? Date.parse(initial.updatedAt) : 0,
      data: { businessName, mobile, abn, acn, address, marketingConsent },
      isEmpty: (d) =>
        !d.businessName && !d.mobile && !d.abn && !d.acn && !d.address,
      onRestore: (d) => {
        setBusinessName(d.businessName ?? "");
        setMobile(d.mobile ?? "");
        setAbn(sanitizeAbn(d.abn ?? ""));
        setAcn(sanitizeAcn(d.acn ?? ""));
        setAddress(d.address ?? "");
        setMarketingConsent(d.marketingConsent ?? false);
      },
    },
  );

  const setFieldError = (field: string, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  // Field-level checks, run on blur (with the live DOM value, so browser
  // autofill that never fired a change event is still validated correctly)
  // and on submit. Typing clears the field's error (Bug #19).
  const fieldError = (field: string, value: string): string | null => {
    switch (field) {
      case "businessName":
        return value.trim() ? null : "Business name is required";
      case "mobile":
        return mobileValidationError(value, true);
      case "abn":
        return isValidAbn(value) ? null : "ABN must be 11 digits";
      case "acn":
        return value && !isValidAcn(value) ? "ACN must be 9 digits" : null;
      case "address":
        return addressValidationError(value);
      default:
        return null;
    }
  };

  const validate = () => {
    const checks: Array<[string, string]> = [
      ["businessName", businessName],
      ["mobile", mobile],
      ["abn", abn],
      ["acn", acn],
      ["address", address],
    ];
    const e: Record<string, string> = {};
    for (const [field, value] of checks) {
      const msg = fieldError(field, value);
      if (msg) e[field] = msg;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    upsert.mutate(
      {
        data: {
          businessName: businessName.trim(),
          mobile: formatStoredMobile(mobile),
          abn,
          acn: acn || null,
          address: address.trim(),
          marketingConsent,
        },
      },
      {
        onSuccess: (profile) => {
          clearDraft();
          qc.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
          toast.success("Business profile saved");
          onSaved?.(profile);
        },
        onError: () => toast.error("Couldn't save your profile. Please try again."),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="businessName">Business name</Label>
        <Input
          id="businessName"
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            setFieldError("businessName", null);
          }}
          onBlur={(e) => {
            setBusinessName(e.target.value);
            setFieldError("businessName", fieldError("businessName", e.target.value));
          }}
          placeholder="e.g. Smith Plumbing"
        />
        {errors.businessName && (
          <p className="text-xs text-destructive">{errors.businessName}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mobile">Mobile</Label>
        <MobileInput
          id="mobile"
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
        <Label htmlFor="abn">ABN</Label>
        <Input
          id="abn"
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
          placeholder="11 digits"
        />
        {errors.abn && <p className="text-xs text-destructive">{errors.abn}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="acn">
          ACN <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="acn"
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
          placeholder="9 digits"
        />
        {errors.acn && <p className="text-xs text-destructive">{errors.acn}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Business address</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setFieldError("address", null);
          }}
          onBlur={(e) => {
            setAddress(e.target.value);
            setFieldError("address", fieldError("address", e.target.value));
          }}
          placeholder="Street, suburb, state, postcode"
          rows={2}
        />
        {errors.address && (
          <p className="text-xs text-destructive">{errors.address}</p>
        )}
      </div>

      <div className="flex items-start gap-2.5 pt-1">
        <Checkbox
          id="marketingConsent"
          checked={marketingConsent}
          onCheckedChange={(c) => setMarketingConsent(c === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="marketingConsent"
          className="text-sm font-normal leading-snug text-muted-foreground"
        >
          Send me occasional product updates and tips. You can opt out anytime.
        </Label>
      </div>

      <Button
        type="submit"
        disabled={upsert.isPending}
        className="w-full h-11 text-base font-semibold"
      >
        {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
