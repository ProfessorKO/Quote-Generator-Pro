import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRedeemCoupon } from "@workspace/api-client-react";
import { useInvalidateBilling } from "@/lib/billing";

/**
 * Coupon code input on the billing screen. Redeeming a valid free_trial
 * code grants Pro immediately (no Stripe checkout involved).
 */
export function CouponInput({
  onRedeemed,
}: {
  /** Called after a successful redemption (e.g. to close a limit dialog). */
  onRedeemed?: () => void;
} = {}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const redeem = useRedeemCoupon();
  const invalidateBilling = useInvalidateBilling();

  const apply = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter a coupon code.");
      return;
    }
    setError(null);
    redeem.mutate(
      { data: { code: trimmed } },
      {
        onSuccess: (res) => {
          invalidateBilling();
          setCode("");
          const until = res.trialEndsAt
            ? format(new Date(res.trialEndsAt), "d MMM yyyy")
            : null;
          toast.success(
            `Coupon applied! You're on Pro for ${res.trialDays} days${until ? ` — until ${until}` : ""}.`,
          );
          onRedeemed?.();
        },
        onError: (err) => {
          const e = err as { data?: { error?: string } } | null;
          setError(
            e?.data?.error ??
              "Couldn't apply that coupon. Please try again.",
          );
        },
      },
    );
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium flex items-center gap-1.5">
        <Ticket className="w-4 h-4 text-primary" />
        Have a coupon code?
      </p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply();
          }}
          placeholder="Enter coupon code"
          aria-label="Coupon code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-10"
        />
        <Button
          variant="secondary"
          className="h-10 px-4 font-semibold shrink-0"
          onClick={apply}
          disabled={redeem.isPending || !code.trim()}
        >
          {redeem.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Apply
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
