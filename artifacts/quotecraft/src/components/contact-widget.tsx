import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const MESSAGE_LIMIT = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Floating "Contact Us" widget: a fixed round button (bottom-right) that
 * opens a dialog with a contact form. Submissions are emailed to the
 * support inbox via the API.
 */
export function ContactWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setMobile("");
    setMessage("");
    setErrors({});
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address";
    if (mobile && mobile.length !== 8) next.mobile = "Enter exactly 8 digits";
    if (!message.trim()) next.message = "Message is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSending(true);
    try {
      const res = await fetch(`${basePath}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          mobile: mobile || undefined,
          message: message.trim(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't send your message. Please try again.");
      }
      toast.success("Thanks for reaching out! We'll get back to you soon.");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          aria-label="Contact us"
          className="fixed bottom-5 right-5 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-[#1B2C4D] p-3.5 text-white shadow-lg transition-colors hover:bg-[#13203A] focus:outline-none focus:ring-2 focus:ring-[#1B2C4D]/40"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact Us</DialogTitle>
          <DialogDescription>
            Send us a message and we&apos;ll get back to you at{" "}
            <a
              href="mailto:support@workmatespro.com.au"
              className="font-medium text-[#1B2C4D] underline underline-offset-2"
            >
              support@workmatespro.com.au
            </a>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              maxLength={200}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-mobile">Mobile (optional)</Label>
            <div className="flex items-center gap-2">
              <span className="flex h-9 shrink-0 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                +61-04
              </span>
              <Input
                id="contact-mobile"
                inputMode="numeric"
                value={mobile}
                onChange={(e) =>
                  setMobile(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="12345678"
                className="flex-1"
              />
            </div>
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-message">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="contact-message"
              value={message}
              maxLength={MESSAGE_LIMIT}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_LIMIT))}
              placeholder="How can we help?"
              rows={4}
            />
            <div className="flex justify-between">
              {errors.message ? (
                <p className="text-xs text-destructive">{errors.message}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground">
                {message.length}/{MESSAGE_LIMIT}
              </p>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              "Send message"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
