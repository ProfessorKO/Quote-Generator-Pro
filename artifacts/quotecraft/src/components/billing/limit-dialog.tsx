import { useState } from "react";
import { Loader2, Crown, Coins } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateBillingCheckout } from "@workspace/api-client-react";
import { CreditPacks } from "@/components/billing/credit-packs";
import { useBilling, type LimitAction } from "@/lib/billing";

// CP1–CP5 — action-specific copy for the free-tier limit dialogs.
const COPY: Record<LimitAction, { title: string; body: string }> = {
  newQuotes: {
    title: "You've used your 3 free quotes this month",
    body: "You've reached your free limit of 3 new quotes this month. Go Pro for unlimited quotes, or buy credits to keep going — 1 credit per quote.",
  },
  voiceEdits: {
    title: "You've used your 3 free voice edits this month",
    body: "You've reached your free limit of 3 voice edits this month. Go Pro for unlimited voice editing, or buy credits — 1 credit per voice edit. Manual edits are always free.",
  },
  emailsSent: {
    title: "You've used your 3 free emails this month",
    body: "You've reached your free limit of 3 quote emails this month. Go Pro for unlimited emails, or buy credits — 1 credit per email.",
  },
  pdfDownloads: {
    title: "You've used your 3 free PDF downloads this month",
    body: "You've reached your free limit of 3 PDF downloads this month. Go Pro for unlimited downloads, or buy credits — 1 credit per download.",
  },
  templates: {
    title: "You've used all 5 free template slots",
    body: "The free plan includes 5 saved templates. Go Pro for unlimited templates, or buy credits — 1 credit saves 1 extra template. Your existing templates always stay editable.",
  },
};

interface LimitDialogProps {
  action: LimitAction | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * CP1–CP5 — shown when the server answers 402 LIMIT_REACHED. Offers the Pro
 * subscription and credit packs; free limits reset on the 1st of each month
 * (Sydney time).
 */
export function LimitDialog({ action, onOpenChange }: LimitDialogProps) {
  const checkout = useCreateBillingCheckout();
  const { data: billing } = useBilling();
  const [showPacks, setShowPacks] = useState(false);

  const copy = action ? COPY[action] : null;

  const subscribe = () => {
    checkout.mutate(
      { data: { type: "subscription" } },
      {
        onSuccess: (res) => {
          if (res.resumed) {
            toast.success("Welcome back! Your Pro subscription is active again.");
            onOpenChange(false);
          } else if (res.url) {
            window.location.href = res.url;
          } else {
            toast.error("Couldn't start checkout. Please try again.");
          }
        },
        onError: () => toast.error("Couldn't start checkout. Please try again."),
      },
    );
  };

  return (
    <Dialog
      open={action !== null}
      onOpenChange={(o) => {
        if (!o) setShowPacks(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md w-[92vw] rounded-xl">
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.body}</DialogDescription>
        </DialogHeader>

        {showPacks ? (
          <CreditPacks />
        ) : (
          <div className="space-y-2 py-1">
            <Button
              className="w-full h-11 font-semibold"
              onClick={subscribe}
              disabled={checkout.isPending}
            >
              {checkout.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Crown className="w-4 h-4" />
              )}
              Go Pro — $4.99/month, unlimited everything
            </Button>
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={() => setShowPacks(true)}
            >
              <Coins className="w-4 h-4" />
              Buy credits from $2
            </Button>
            {typeof billing?.credits === "number" && billing.credits > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                You have {billing.credits} credit
                {billing.credits === 1 ? "" : "s"} left.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
        <p className="text-[11px] text-center text-muted-foreground">
          Free limits reset on the 1st of each month.
        </p>
      </DialogContent>
    </Dialog>
  );
}
