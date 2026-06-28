import React, { useState } from "react";
import "./_group.css";
import { Check, ShieldCheck, Mail, Building2, User, Lock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Registration() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);

  const handleInput = (index: number, value: string) => {
    if (value.length <= 1) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
    }
  };

  return (
    <div className="min-h-screen bg-background font-['Inter'] text-foreground flex justify-center">
      <div className="w-full max-w-[400px] bg-background min-h-screen flex flex-col shadow-xl sm:border-x border-border overflow-hidden relative">
        {/* Sticky Header */}
        <header className="sticky top-0 z-10 bg-primary text-primary-foreground py-4 px-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-accent text-accent-foreground flex items-center justify-center font-bold text-lg">
              Q
            </div>
            <span className="font-bold text-lg tracking-tight">QuoteCraft</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-primary-foreground/80 bg-primary-foreground/10 px-2 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-6 flex flex-col">
          {/* Context banner — registration is triggered by save/download/email */}
          <div className="mb-5 rounded-lg bg-accent/10 border border-accent/30 px-3 py-2.5 text-xs text-foreground/80 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
            <span>
              Register to <span className="font-semibold">save, download or email</span> your quote.
              Generating quotes is always free — no account needed.
            </span>
          </div>

          {/* Step Indicator — 2 steps: Details -> Verify email */}
          <div className="flex items-center justify-center mb-8 relative px-10">
            <div className="absolute top-[14px] left-10 right-10 h-[2px] bg-border -z-10"></div>
            <div className="absolute top-[14px] left-10 w-[calc(100%-5rem)] h-[2px] bg-primary -z-10"></div>

            <div className="flex flex-col items-center gap-1.5 bg-background px-3">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-semibold text-primary">Details</span>
            </div>

            <div className="flex-1"></div>

            <div className="flex flex-col items-center gap-1.5 bg-background px-3">
              <div className="w-7 h-7 rounded-full border-2 border-primary bg-background text-primary flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
              </div>
              <span className="text-[10px] font-bold text-foreground">Verify email</span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Collapsed Summary */}
            <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-600" />
                  Account details
                </h3>
                <button className="text-xs text-primary font-medium">Edit</button>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-medium">Dave's Plumbing</span>
                    <span className="text-xs text-muted-foreground">ABN 12 345 678 901</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>42 Wallaby Way, Sydney NSW 2000</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Dave Thompson</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>dave@davesplumbing.com.au</span>
                </div>
              </div>
            </div>

            {/* Active Step Panel — Verify email */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-5 pb-6">
              <div className="mb-5 text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1.5">Verify your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to <br />
                  <span className="font-semibold text-foreground">dave@davesplumbing.com.au</span>
                </p>
              </div>

              {/* OTP Input */}
              <div className="flex justify-between gap-1.5 mb-6">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInput(i, e.target.value)}
                    className="w-11 h-14 text-center text-xl font-semibold border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="-"
                  />
                ))}
              </div>

              <div className="text-center mb-6">
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <span className="opacity-70">Resend in</span> <span className="font-medium text-primary">0:42</span>
                </button>
              </div>

              <Button className="w-full h-12 text-base font-medium shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">
                Verify &amp; create account
              </Button>
            </div>

            {/* Clerk attribution */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Secured by</span>
              <span className="font-semibold text-foreground">Clerk</span>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center border-t border-border bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Already have an account? <a href="#" className="font-semibold text-primary hover:underline">Log in</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
