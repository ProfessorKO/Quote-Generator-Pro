import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

const LISTEN_WINDOW_SECONDS = 30;

export function VoiceOverlay({
  open,
  title,
  transcript,
  secondsLeft,
  onStop,
  onCancel,
}: {
  open: boolean;
  title: string;
  transcript: string;
  secondsLeft: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="alertdialog"
      aria-live="assertive"
      aria-label="Voice input in progress"
    >
      {/* Scrim — blocks and dims the whole screen */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-[3px]" />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes qc-eq {
              0%, 100% { transform: scaleY(0.3); }
              50% { transform: scaleY(1); }
            }
            .qc-eq-bar { animation: qc-eq 1s ease-in-out infinite; transform-origin: bottom; }
            .qc-eq-1 { animation-delay: 0s; }
            .qc-eq-2 { animation-delay: 0.2s; }
            .qc-eq-3 { animation-delay: 0.4s; }
            .qc-eq-4 { animation-delay: 0.1s; }
            .qc-eq-5 { animation-delay: 0.3s; }
            .qc-eq-6 { animation-delay: 0.5s; }
            .qc-eq-7 { animation-delay: 0.2s; }
          `,
        }}
      />

      <div className="relative w-full h-full max-w-[440px] mx-auto flex flex-col items-center justify-center px-6 py-10 animate-in fade-in duration-300">
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* Large pulsing mic in the centre of the screen */}
          <div className="relative mb-10 flex items-center justify-center">
            <div
              className="absolute w-28 h-28 bg-accent/30 rounded-full animate-ping"
              style={{ animationDuration: "2s" }}
            />
            <div
              className="absolute w-36 h-36 bg-accent/15 rounded-full animate-pulse"
              style={{ animationDuration: "2s" }}
            />
            <div className="relative z-10 w-24 h-24 bg-accent rounded-full flex items-center justify-center shadow-lg shadow-accent/40 text-accent-foreground">
              <Mic className="w-10 h-10" />
            </div>
          </div>

          <h3 className="text-xl font-semibold text-foreground mb-1">Listening…</h3>
          <p className="text-sm text-muted-foreground mb-5">{title}</p>

          {/* Animated equalizer */}
          <div className="flex items-end justify-center gap-1.5 h-8 mb-6 opacity-90">
            <div className="w-1.5 h-full bg-accent rounded-full qc-eq-bar qc-eq-1" />
            <div className="w-1.5 h-3/4 bg-accent rounded-full qc-eq-bar qc-eq-2" />
            <div className="w-1.5 h-full bg-accent rounded-full qc-eq-bar qc-eq-3" />
            <div className="w-1.5 h-1/2 bg-accent rounded-full qc-eq-bar qc-eq-4" />
            <div className="w-1.5 h-full bg-accent rounded-full qc-eq-bar qc-eq-5" />
            <div className="w-1.5 h-2/3 bg-accent rounded-full qc-eq-bar qc-eq-6" />
            <div className="w-1.5 h-full bg-accent rounded-full qc-eq-bar qc-eq-7" />
          </div>

          {/* Live transcript */}
          <div className="w-full min-h-[100px] bg-card rounded-2xl p-5 mb-6 shadow-sm border border-border text-center flex items-center justify-center">
            {transcript ? (
              <p className="text-lg text-foreground leading-relaxed font-medium">
                “{transcript}
                <span
                  className="animate-pulse inline-block w-1.5 h-5 bg-accent ml-1 align-middle rounded-sm"
                  style={{ animationDuration: "1s" }}
                />
                ”
              </p>
            ) : (
              <p className="text-base text-muted-foreground leading-relaxed">
                Start speaking — your words appear here.
              </p>
            )}
          </div>

          {/* 30-second capture window */}
          <div className="w-full max-w-sm mb-2">
            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-1000 ease-linear"
                style={{ width: `${(secondsLeft / LISTEN_WINDOW_SECONDS) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2 font-medium">
              Auto-stops in {secondsLeft}s
            </p>
          </div>
        </div>

        {/* Actions pinned to bottom */}
        <div className="w-full flex flex-col gap-3 max-w-sm pb-2">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-xl shadow-md"
            onClick={onStop}
          >
            Stop / Done
          </Button>
          <Button
            variant="ghost"
            className="w-full h-12 text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-1 font-medium">
            Screen locked while listening — tap Stop when finished.
          </p>
        </div>
      </div>
    </div>
  );
}
