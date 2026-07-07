import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  FileText,
  Mic,
  Calculator,
  FileDown,
  ArrowRight,
  LogIn,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Mic,
    title: "Quote by voice",
    desc: "Speak the job — line items and prices appear instantly.",
  },
  {
    icon: Calculator,
    title: "Australian tax, sorted",
    desc: "10% GST, call-out fees and surcharges calculated for you.",
  },
  {
    icon: FileText,
    title: "Reusable templates",
    desc: "Save common jobs and reload them in a tap.",
  },
  {
    icon: FileDown,
    title: "Branded PDFs",
    desc: "Send professional quotes straight to your clients.",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();

  const startAsGuest = () => setLocation("/quote?new=1");

  const signIn = () => setLocation("/sign-in");

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center">
      <div className="w-full max-w-[430px] bg-background shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-border">
        {/* Hero */}
        <div className="relative bg-primary text-primary-foreground px-6 pt-14 pb-12 overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-accent/20 blur-2xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-accent/10 blur-2xl"
          />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-10"
          >
            <div className="flex items-center gap-3">
              <div className="bg-accent text-accent-foreground p-2.5 rounded-xl shadow-lg">
                <FileText className="w-6 h-6" />
              </div>
              <span className="font-bold text-xl tracking-tight">QuoteCraft</span>
            </div>

            <h1 className="mt-9 text-4xl font-bold leading-[1.1] tracking-tight">
              Quotes, done
              <br />
              by <span className="text-accent">voice.</span>
            </h1>
            <p className="mt-4 text-primary-foreground/75 text-base leading-relaxed">
              Build accurate, GST-ready quotes for your Australian business in
              seconds — just say the job.
            </p>
          </motion.div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col px-6 py-8">
          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex flex-col gap-3"
          >
            <Button
              size="lg"
              onClick={startAsGuest}
              className="h-13 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-md"
            >
              Try it now — no sign-up
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={signIn}
              className="h-13 text-base font-semibold"
            >
              <LogIn className="w-5 h-5" />
              Sign in
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-1">
              Free to try. Create an account when you're ready to save, download
              or email a quote.
            </p>
          </motion.div>

          {/* Features */}
          <div className="mt-9 space-y-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 + i * 0.06 }}
                className="flex items-start gap-3.5 rounded-xl border border-card-border bg-card p-3.5"
              >
                <div className="shrink-0 bg-secondary text-secondary-foreground p-2 rounded-lg">
                  <f.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-card-foreground">
                    {f.title}
                  </p>
                  <p className="text-sm text-muted-foreground leading-snug">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Trust line */}
          <div className="mt-auto pt-8">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-accent" />
              Built for Australian tradies & small businesses
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
