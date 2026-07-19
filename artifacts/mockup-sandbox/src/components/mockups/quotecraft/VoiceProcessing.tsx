import React from "react";
import { Mic, ArrowLeft, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./_group.css";

export function VoiceProcessing() {
  return (
    <div className="w-full max-w-[400px] mx-auto min-h-[800px] h-[100dvh] bg-background font-['Inter'] text-foreground relative overflow-hidden flex flex-col shadow-xl border-x border-border">
      {/* Background Quote App Screen */}
      
      {/* Top Navigation */}
      <header className="flex-none bg-primary text-primary-foreground sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button className="p-1 -ml-1 text-primary-foreground/80 hover:text-primary-foreground rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-semibold leading-tight">Quote #QT-2024-089</h1>
            <p className="text-xs text-primary-foreground/70 font-medium">Draft • Dave's Plumbing</p>
          </div>
        </div>
        <button className="p-1 -mr-1 text-primary-foreground/80 hover:text-primary-foreground rounded-full transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content (Blurred/Dimmed by overlay) */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {/* Customer Card */}
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="font-semibold text-card-foreground">Dave's Plumbing</h2>
              <p className="text-sm text-muted-foreground mt-0.5">dave@davesplumbing.com.au</p>
              <p className="text-sm text-muted-foreground">0412 345 678</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="text-sm text-card-foreground font-medium">Job Address</p>
            <p className="text-sm text-muted-foreground mt-0.5">42 Wallaby Way, Sydney NSW 2000</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex justify-between items-center">
            <h3 className="font-semibold text-card-foreground">Line Items</h3>
            <button className="text-primary text-sm font-medium flex items-center gap-1 hover:underline">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
          <div className="divide-y divide-border">
            {/* Item 1 */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-1">
                <p className="font-medium text-sm text-card-foreground">Replace Hot Water System</p>
                <p className="font-semibold text-sm">$1,250.00</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Supply and install 250L electric hot water unit</p>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>1 x $1,250.00</span>
                <span>GST: $125.00</span>
              </div>
            </div>
            
            {/* Item 2 */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-1">
                <p className="font-medium text-sm text-card-foreground">Labour (Standard Hours)</p>
                <p className="font-semibold text-sm">$360.00</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Plumbing labour for installation</p>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>4 hrs x $90.00</span>
                <span>GST: $36.00</span>
              </div>
            </div>
          </div>
          <div className="bg-secondary/30 p-4 border-t border-border flex justify-between items-center">
            <p className="font-medium text-sm text-muted-foreground">Subtotal</p>
            <p className="font-semibold text-sm text-card-foreground">$1,610.00</p>
          </div>
        </div>
      </main>

      {/* Voice Processing Overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center">
        {/* Scrim */}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[3px]" />
        
        {/* Overlay Content */}
        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 py-10 animate-in fade-in duration-300">
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes eq {
              0%, 100% { transform: scaleY(0.3); }
              50% { transform: scaleY(1); }
            }
            .eq-bar {
              animation: eq 1s ease-in-out infinite;
              transform-origin: bottom;
            }
            .eq-1 { animation-delay: 0.0s; }
            .eq-2 { animation-delay: 0.2s; }
            .eq-3 { animation-delay: 0.4s; }
            .eq-4 { animation-delay: 0.1s; }
            .eq-5 { animation-delay: 0.3s; }
            .eq-6 { animation-delay: 0.5s; }
            .eq-7 { animation-delay: 0.2s; }
          `}} />

          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mt-8">
            
            {/* Pulsing Mic */}
            <div className="relative mb-12 flex items-center justify-center">
              {/* Ping Rings */}
              <div className="absolute w-28 h-28 bg-accent/30 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute w-36 h-36 bg-accent/15 rounded-full animate-pulse" style={{ animationDuration: '2s' }} />
              
              {/* Mic Button */}
              <div className="relative z-10 w-24 h-24 bg-accent rounded-full flex items-center justify-center shadow-lg shadow-accent/40 text-accent-foreground">
                <Mic className="w-10 h-10" />
              </div>
            </div>

            <div className="flex flex-col items-center w-full">
              <h3 className="text-xl font-semibold text-foreground mb-5">Listening...</h3>
              
              <div className="flex items-end justify-center gap-1.5 h-8 mb-8 opacity-90">
                <div className="w-1.5 h-full bg-accent rounded-full eq-bar eq-1" />
                <div className="w-1.5 h-3/4 bg-accent rounded-full eq-bar eq-2" />
                <div className="w-1.5 h-full bg-accent rounded-full eq-bar eq-3" />
                <div className="w-1.5 h-1/2 bg-accent rounded-full eq-bar eq-4" />
                <div className="w-1.5 h-full bg-accent rounded-full eq-bar eq-5" />
                <div className="w-1.5 h-2/3 bg-accent rounded-full eq-bar eq-6" />
                <div className="w-1.5 h-full bg-accent rounded-full eq-bar eq-7" />
              </div>

              <div className="w-full min-h-[100px] bg-card rounded-2xl p-5 mb-8 shadow-sm border border-border text-center flex items-center justify-center">
                <p className="text-lg text-foreground leading-relaxed font-medium">
                  "add a ten percent discount to labour<span className="animate-pulse inline-block w-1.5 h-5 bg-accent ml-1 align-middle rounded-sm" style={{ animationDuration: '1s' }}></span>"
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons Pinned to Bottom */}
          <div className="w-full flex flex-col gap-3 max-w-sm pb-4">
            <Button size="lg" className="w-full h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
              Stop / Done
            </Button>
            <Button variant="ghost" className="w-full h-12 text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
            
            <p className="text-xs text-muted-foreground text-center mt-3 font-medium">
              Screen locked while listening — tap Stop when finished.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
