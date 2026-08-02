import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Loader2, Crown, Coins } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  useCreateBillingCheckout,
  useConfirmBillingCheckout,
  useCancelBillingSubscription,
} from "@workspace/api-client-react";
import { CreditPacks } from "@/components/billing/credit-packs";
import { CouponInput } from "@/components/billing/coupon-input";
import { useBilling, useInvalidateBilling } from "@/lib/billing";

const CANCEL_REASONS = [
  "Too expensive",
  "Not using it enough",
  "Missing features I need",
  "Found a better alternative",
  "Just taking a break",
  "Other",
];

/**
 * Settings → Subscription & credits.
 * CP7 — cancel subscription with a short exit survey.
 * CP8 — subscribe to Pro.
 * CP9 — buy credit packs.
 * Also finalises Stripe Checkout redirects (?checkout=success&session_id=...).
 */
export function SubscriptionSection() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { data: billing, isLoading } = useBilling();
  const invalidateBilling = useInvalidateBilling();
  const checkout = useCreateBillingCheckout();
  const confirm = useConfirmBillingCheckout();
  const cancelSub = useCancelBillingSubscription();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [otherText, setOtherText] = useState("");
  const [confirming, setConfirming] = useState(false);
  // A session that arrived via redirect but hasn't been confirmed yet. Kept
  // (and the URL left intact) until confirm SUCCEEDS, so a transient failure
  // never strands a paid checkout — the user can retry.
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const startedRef = useRef<string | null>(null);

  const runConfirm = (sessionId: string) => {
    setConfirming(true);
    confirm.mutate(
      { data: { sessionId } },
      {
        onSuccess: (res) => {
          invalidateBilling();
          if (res.result === "subscription_active") {
            toast.success("You're on Pro! Everything is now unlimited.");
          } else {
            toast.success(
              `${res.creditsAdded ?? 0} credits added — you now have ${res.credits ?? 0}.`,
            );
          }
          setPendingSessionId(null);
          // Only strip the URL once the purchase is safely confirmed.
          setLocation("/settings", { replace: true });
        },
        onError: () => {
          setPendingSessionId(sessionId);
          toast.error(
            "We couldn't confirm your payment yet. Your money is safe — tap “Finish confirming purchase” to retry.",
          );
        },
        onSettled: () => setConfirming(false),
      },
    );
  };

  // Finalise a Stripe Checkout redirect. The confirm endpoint is idempotent
  // server-side; the ref avoids duplicate auto-calls for the same session
  // (e.g. React strict-mode double effects).
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sessionId = params.get("session_id");
    const status = params.get("checkout");

    if (status === "cancelled" && !sessionId) {
      setLocation("/settings", { replace: true });
      return;
    }
    if (!sessionId || startedRef.current === sessionId) return;
    startedRef.current = sessionId;
    runConfirm(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const subscribe = () => {
    checkout.mutate(
      { data: { type: "subscription" } },
      {
        onSuccess: (res) => {
          if (res.resumed) {
            invalidateBilling();
            toast.success("Welcome back! Your Pro subscription is active again.");
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

  const submitCancel = () => {
    const finalReason =
      reason === "Other" ? `Other: ${otherText.trim() || "unspecified"}` : reason;
    cancelSub.mutate(
      { data: { reason: finalReason || undefined } },
      {
        onSuccess: () => {
          invalidateBilling();
          setCancelOpen(false);
          toast.success(
            "Subscription cancelled. Pro stays active until the end of your billing period.",
          );
        },
        onError: () => toast.error("Couldn't cancel. Please try again."),
      },
    );
  };

  if (isLoading || confirming) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
        {confirming && (
          <p className="text-xs text-muted-foreground">Confirming your purchase…</p>
        )}
      </div>
    );
  }

  if (!billing) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Couldn't load your plan. Pull to refresh or try again shortly.
      </p>
    );
  }

  const isPro = billing.plan === "pro";
  // Coupon-granted free trial: Pro access without a Stripe subscription.
  const isTrial = billing.planSource === "trial";
  const trialEnd = billing.trialEndsAt
    ? format(new Date(billing.trialEndsAt), "d MMM yyyy")
    : null;
  const periodEnd = billing.currentPeriodEnd
    ? format(new Date(billing.currentPeriodEnd), "d MMM yyyy")
    : null;
  const u = billing.usage;
  const l = billing.limits;

  return (
    <div className="space-y-4">
      {/* Unconfirmed checkout — retry until the purchase is applied */}
      {pendingSessionId && (
        <Button
          className="w-full h-11 font-semibold"
          onClick={() => runConfirm(pendingSessionId)}
          disabled={confirm.isPending}
        >
          {confirm.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Finish confirming purchase
        </Button>
      )}

      {/* Plan summary */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">
              {isPro ? (isTrial ? "Quote Mate Pro (trial)" : "Quote Mate Pro") : "Free plan"}
            </p>
            {isPro && (
              <Badge className="text-[10px]">
                <Crown className="w-3 h-3 mr-0.5" />
                {isTrial ? "Pro trial" : "Pro"}
              </Badge>
            )}
            {isTrial && (
              <Badge variant="secondary" className="text-[10px]">
                Ends {trialEnd ?? "soon"}
              </Badge>
            )}
            {isPro && !isTrial && billing.cancelAtPeriodEnd && (
              <Badge variant="secondary" className="text-[10px]">
                Ends {periodEnd ?? "soon"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTrial
              ? `Free Pro trial — everything unlimited until ${trialEnd ?? "your trial ends"}. Subscribe any time to keep Pro.`
              : isPro
              ? billing.cancelAtPeriodEnd
                ? "Unlimited until your plan ends — you keep all your templates after."
                : `Unlimited quotes, voice edits, emails & PDFs. $4.99/month${periodEnd ? ` · renews ${periodEnd}` : ""}.`
              : "3 free quotes, voice edits, emails & PDF downloads per month, plus 5 template slots."}
          </p>
        </div>
      </div>

      {/* Free usage meter */}
      {!isPro && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
          <span className="text-muted-foreground">New quotes</span>
          <span className="text-right font-medium">
            {Math.min(u.newQuotes, l.newQuotes)} of {l.newQuotes} used
          </span>
          <span className="text-muted-foreground">Voice edits</span>
          <span className="text-right font-medium">
            {Math.min(u.voiceEdits, l.voiceEdits)} of {l.voiceEdits} used
          </span>
          <span className="text-muted-foreground">Emails sent</span>
          <span className="text-right font-medium">
            {Math.min(u.emailsSent, l.emailsSent)} of {l.emailsSent} used
          </span>
          <span className="text-muted-foreground">PDF downloads</span>
          <span className="text-right font-medium">
            {Math.min(u.pdfDownloads, l.pdfDownloads)} of {l.pdfDownloads} used
          </span>
          <span className="text-muted-foreground">Template slots</span>
          <span className="text-right font-medium">
            {Math.min(billing.templatesCount, l.templates)} of {l.templates} used
          </span>
        </div>
      )}

      {/* Credit balance */}
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Coins className="w-4 h-4 text-primary" />
          Credits
        </span>
        <span className="text-sm font-bold">{billing.credits}</span>
      </div>

      {/* CP8 — subscribe (trial users can subscribe mid-trial; the paid
          plan takes over from the trial) */}
      {(!isPro || isTrial || billing.cancelAtPeriodEnd) && (
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
          {isPro && !isTrial
            ? "Keep Pro — undo cancellation"
            : "Go Pro — $4.99/month"}
        </Button>
      )}

      {/* Coupon code — free users only (Pro/trial users can't redeem) */}
      {!isPro && <CouponInput />}

      {/* CP9 — credit packs (useful on free; also fine for Pro top-ups) */}
      {!isPro && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Buy credits</p>
          <CreditPacks />
        </div>
      )}

      {/* CP7 — cancel (paid subscriptions only; trials just lapse) */}
      {isPro && !isTrial && !billing.cancelAtPeriodEnd && (
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => {
            setReason("");
            setOtherText("");
            setCancelOpen(true);
          }}
        >
          Cancel subscription
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md w-[92vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Cancel your Pro subscription?</DialogTitle>
            <DialogDescription>
              You'll keep Pro until{" "}
              {periodEnd ?? "the end of your billing period"}, then move to the
              free plan. Your templates and history are never deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label>Mind telling us why? (optional)</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {CANCEL_REASONS.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <RadioGroupItem value={r} id={`cancel-${r}`} />
                  <Label htmlFor={`cancel-${r}`} className="font-normal text-sm">
                    {r}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {reason === "Other" && (
              <Textarea
                rows={2}
                placeholder="Tell us more…"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
              />
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setCancelOpen(false)}
            >
              Keep Pro
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={submitCancel}
              disabled={cancelSub.isPending}
            >
              {cancelSub.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
