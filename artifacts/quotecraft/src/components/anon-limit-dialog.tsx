import { useLocation } from "wouter";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AnonLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shown when a signed-out visitor hits the 3-per-day AI limit (server 429
 * ANON_DAILY_LIMIT_REACHED). The in-progress quote is preserved by the
 * unsaved-quote restore flow, so signing up never loses their work.
 */
export function AnonLimitDialog({ open, onOpenChange }: AnonLimitDialogProps) {
  const [, setLocation] = useLocation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] max-w-[92vw] overflow-hidden rounded-xl">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">
            That's your 3 free goes for today
          </DialogTitle>
          <DialogDescription className="break-words">
            Visitors get 3 free AI quote actions a day — generating a quote or
            editing it by voice. Create a free account to keep going; your
            quote stays right where you left it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Button
            className="w-full h-auto min-h-11 whitespace-normal text-center font-semibold"
            onClick={() => {
              onOpenChange(false);
              setLocation("/sign-up");
            }}
          >
            <UserPlus className="w-4 h-4" />
            <span className="min-w-0">Create a free account</span>
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Free accounts get 3 quotes, 3 voice edits, 3 emails and 3 PDF
            downloads every month.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
        <p className="text-[11px] text-center text-muted-foreground break-words">
          Free visitor limit resets each day.
        </p>
      </DialogContent>
    </Dialog>
  );
}
