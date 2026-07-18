import { useState } from "react";
import { Loader2, Coins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreateBillingCheckout } from "@workspace/api-client-react";
import { useBilling, formatAud } from "@/lib/billing";
import { cn } from "@/lib/utils";

/**
 * CP9 — credit pack purchase grid. 1 credit = 1 action (new quote, voice
 * edit, email or PDF download). Credits never expire.
 */
export function CreditPacks({ compact = false }: { compact?: boolean }) {
  const { data: billing } = useBilling();
  const checkout = useCreateBillingCheckout();
  const [buying, setBuying] = useState<number | null>(null);

  const packs = billing?.creditPacks ?? [];

  const buy = (credits: number) => {
    setBuying(credits);
    checkout.mutate(
      { data: { type: "credits", credits } },
      {
        onSuccess: (res) => {
          if (res.url) {
            window.location.href = res.url;
          } else {
            setBuying(null);
            toast.error("Couldn't start checkout. Please try again.");
          }
        },
        onError: () => {
          setBuying(null);
          toast.error("Couldn't start checkout. Please try again.");
        },
      },
    );
  };

  if (packs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Credit packs are loading — try again in a moment.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-xs text-muted-foreground">
          1 credit = 1 action (new quote, voice edit, email or PDF download).
          Credits never expire and are used before your free monthly limits.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {packs.map((pack) => (
          <Button
            key={pack.credits}
            variant="outline"
            className={cn(
              "h-auto flex-col gap-0.5 py-3",
              pack.credits === 50 && "border-primary/60",
            )}
            disabled={buying !== null}
            onClick={() => buy(pack.credits)}
          >
            {buying === pack.credits ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-sm">
                <Coins className="w-3.5 h-3.5 text-primary" />
                {pack.credits} credits
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatAud(pack.unitAmount)}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
