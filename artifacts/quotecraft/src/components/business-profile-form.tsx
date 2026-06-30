import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MobileInput } from "@/components/mobile-input";
import {
  useUpsertBusinessProfile,
  getGetBusinessProfileQueryKey,
  type BusinessProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  formatStoredMobile,
  mobileDigitsFromStored,
  isValidMobileDigits,
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

  const validate = () => {
    const e: Record<string, string> = {};
    if (!businessName.trim()) e.businessName = "Business name is required";
    if (!isValidMobileDigits(mobile))
      e.mobile = "Enter the 8 digits after +61 4";
    if (!isValidAbn(abn)) e.abn = "ABN must be 11 digits";
    if (acn && !isValidAcn(acn)) e.acn = "ACN must be 9 digits";
    if (!address.trim()) e.address = "Address is required";
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
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Smith Plumbing"
        />
        {errors.businessName && (
          <p className="text-xs text-destructive">{errors.businessName}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mobile">Mobile</Label>
        <MobileInput id="mobile" value={mobile} onChange={setMobile} />
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
          onChange={(e) => setAbn(sanitizeAbn(e.target.value))}
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
          onChange={(e) => setAcn(sanitizeAcn(e.target.value))}
          placeholder="9 digits"
        />
        {errors.acn && <p className="text-xs text-destructive">{errors.acn}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Business address</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
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
