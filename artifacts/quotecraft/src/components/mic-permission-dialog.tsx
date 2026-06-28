import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MicOff } from "lucide-react";
import { detectDevice, getPermissionGuide } from "@/lib/mic-permission";

// Bug #7 — shown when the microphone is denied. Gives the user exact, written,
// device-specific steps (no deep links) plus a Retry that re-checks permission.
export function MicPermissionDialog({
  open,
  onOpenChange,
  onRetry,
  retrying,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const guide = getPermissionGuide(detectDevice());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[90vw] rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <MicOff className="h-5 w-5" />
            </span>
            <DialogTitle className="text-left">{guide.title}</DialogTitle>
          </div>
          <DialogDescription className="text-left pt-2">
            Microphone access is blocked. Follow these steps for your device, then
            tap Retry.
          </DialogDescription>
        </DialogHeader>

        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
          {guide.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={onRetry}
            disabled={retrying}
            className="w-full sm:w-auto"
          >
            {retrying ? "Checking…" : "Retry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
