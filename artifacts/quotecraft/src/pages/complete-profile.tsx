import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { BusinessProfileForm } from "@/components/business-profile-form";
import { peekPendingAction } from "@/lib/auth-actions";

export default function CompleteProfile() {
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const handleSaved = () => {
    // Resume a pending gated action (home reads it), else go to the dashboard.
    setLocation(peekPendingAction() ? "/quote" : "/dashboard");
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex justify-center">
      <div className="w-full max-w-[430px] bg-background shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-border">
        <div className="relative bg-primary text-primary-foreground px-6 pt-12 pb-10 overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-accent/20 blur-2xl"
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
              <span className="font-bold text-xl tracking-tight">
                Quote Mate
                <span className="ml-2 align-middle text-xs font-medium tracking-wide text-primary-foreground/70 uppercase">
                  Work Mates Pro
                </span>
              </span>
            </div>
            <h1 className="mt-7 text-2xl font-bold leading-tight tracking-tight">
              {user?.firstName ? `Welcome, ${user.firstName}!` : "Almost there!"}
            </h1>
            <p className="mt-2 text-primary-foreground/75 text-sm leading-relaxed">
              Tell us about your business. These details pre-fill your branded
              quotes and PDFs.
            </p>
          </motion.div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <BusinessProfileForm submitLabel="Save & continue" onSaved={handleSaved} />
        </div>
      </div>
    </div>
  );
}
