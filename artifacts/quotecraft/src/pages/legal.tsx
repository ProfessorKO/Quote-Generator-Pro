// Privacy Policy & Terms of Service pages (go-live items #29–30).
// Shared layout; content rendered from structured sections so both pages
// stay consistent and easy to update. Linked from the landing footer and
// the sign-up page ("By creating an account you agree…").
import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";

const EFFECTIVE_DATE = "2 August 2026";
const COMPANY = "Cago Tech";
const APP = "Quote Mate";
const SUPPORT_EMAIL = "support@workmatespro.com.au";

type Section = { heading: string; paragraphs: string[]; bullets?: string[] };

function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: Section[];
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto max-w-2xl px-5 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/75 hover:text-primary-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {APP}
          </Link>
          <div className="mt-4 flex items-center gap-2.5">
            <div className="bg-accent text-accent-foreground p-2 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          </div>
          <p className="mt-2 text-sm text-primary-foreground/75">
            Effective date: {EFFECTIVE_DATE}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 pb-16">
        <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p>
        {sections.map((s) => (
          <section key={s.heading} className="mt-7">
            <h2 className="text-base font-semibold text-foreground">
              {s.heading}
            </h2>
            {s.paragraphs.map((p, i) => (
              <p
                key={i}
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-2 list-disc pl-5 space-y-1.5">
                {s.bullets.map((b, i) => (
                  <li
                    key={i}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <p className="mt-10 text-sm text-muted-foreground">
          Questions? Contact us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-accent-foreground underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </main>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This Privacy Policy explains how ${COMPANY} ("we", "us") collects, uses, and protects your personal information when you use ${APP} (the "Service"), in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles.`}
      sections={[
        {
          heading: "1. Information we collect",
          paragraphs: ["We collect the following information when you use the Service:"],
          bullets: [
            "Account details: your name and email address, provided when you sign up (directly or via Google sign-in).",
            "Business profile: your business name, contact details, ABN, logo, and pricing preferences, used to build your quotes.",
            "Quote content: the details of quotes you create, including client names and contact details you enter.",
            "Voice input: audio you record to create or edit quotes is processed to convert speech into quote content. Recordings are processed transiently and are not stored after processing.",
            "Payment information: subscription and credit purchases are processed by Stripe. We never see or store your full card details.",
            "Usage data: feature usage counts (e.g. quotes generated) used to apply plan limits, and technical logs for security and reliability.",
          ],
        },
        {
          heading: "2. How we use your information",
          paragraphs: ["We use your information to:"],
          bullets: [
            "Provide the Service — generating, saving, and emailing quotes on your behalf.",
            "Process voice recordings and quote text using AI services to produce your quote content.",
            "Manage your subscription, credits, and billing.",
            "Send transactional emails (quotes to your clients, account verification codes).",
            "Maintain security, prevent abuse, and comply with legal obligations.",
          ],
        },
        {
          heading: "3. Sharing and third parties",
          paragraphs: [
            "We do not sell your personal information. We share data only with service providers needed to run the Service:",
          ],
          bullets: [
            "Authentication (Clerk) — account sign-in and verification emails.",
            "Payments (Stripe) — subscription and credit purchases.",
            "Email delivery (Resend) — sending quote emails you request.",
            "AI processing (OpenAI via secured proxy) — converting voice and text input into quote content. Input is processed to provide the feature, not to train models.",
            "Hosting (Replit) — application and database hosting.",
          ],
        },
        {
          heading: "4. Storage and security",
          paragraphs: [
            "Your data is stored in secured databases with encryption in transit. Access is limited to what is required to operate the Service. Some service providers may process data outside Australia; we take reasonable steps to ensure comparable protections apply.",
          ],
        },
        {
          heading: "5. Retention and deletion",
          paragraphs: [
            "We keep your account data while your account is active. You can request deletion of your account and associated data at any time by contacting us, and we will delete it within a reasonable period unless we are legally required to retain it (e.g. transaction records).",
          ],
        },
        {
          heading: "6. Your rights",
          paragraphs: [
            "You may request access to, correction of, or deletion of your personal information. To exercise these rights, or to complain about a privacy matter, contact us at the address below. You may also complain to the Office of the Australian Information Commissioner (OAIC).",
          ],
        },
        {
          heading: "7. Changes to this policy",
          paragraphs: [
            "We may update this policy from time to time. Material changes will be notified in the app or by email. Continued use of the Service after changes take effect constitutes acceptance.",
          ],
        },
      ]}
    />
  );
}

export function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These Terms of Service ("Terms") govern your use of ${APP}, operated by ${COMPANY}. By creating an account or using the Service, you agree to these Terms.`}
      sections={[
        {
          heading: "1. The Service",
          paragraphs: [
            `${APP} helps you create, manage, and send professional quotes, including by voice input. The Service is provided on free and paid plans with usage limits that may change over time.`,
          ],
        },
        {
          heading: "2. Your account",
          paragraphs: [
            "You must provide accurate information and keep your login credentials secure. You are responsible for activity under your account. You must be at least 16 years old and using the Service for business purposes.",
          ],
        },
        {
          heading: "3. Your content",
          paragraphs: [
            "You retain ownership of the quotes, business details, and other content you create. You grant us a licence to store and process that content solely to provide the Service. You are responsible for the accuracy of quotes you send and for having the right to use any client details you enter.",
          ],
        },
        {
          heading: "4. AI-generated content",
          paragraphs: [
            "Quote content generated from your voice or text input is produced by AI and may contain errors. You must review quotes before sending them. We are not responsible for pricing errors, omissions, or other inaccuracies in generated content.",
          ],
        },
        {
          heading: "5. Payments, subscriptions and credits",
          paragraphs: [],
          bullets: [
            "Paid plans and credit packs are billed via Stripe in Australian dollars, inclusive of GST where applicable.",
            "Subscriptions renew automatically until cancelled. You can cancel at any time; access continues until the end of the paid period.",
            "Credits are consumed by usage and are non-refundable except as required by law (including the Australian Consumer Law).",
            "Promotional codes and free trials are subject to their stated conditions and may be withdrawn at any time.",
          ],
        },
        {
          heading: "6. Acceptable use",
          paragraphs: ["You must not:"],
          bullets: [
            "Use the Service for unlawful, misleading, or fraudulent purposes, including sending spam.",
            "Attempt to bypass usage limits, security measures, or access other users' data.",
            "Resell or provide the Service to third parties without our consent.",
          ],
        },
        {
          heading: "7. Availability and changes",
          paragraphs: [
            "We aim for high availability but do not guarantee uninterrupted service. We may modify or discontinue features with reasonable notice where practical.",
          ],
        },
        {
          heading: "8. Liability",
          paragraphs: [
            "Nothing in these Terms excludes rights you have under the Australian Consumer Law. Otherwise, to the maximum extent permitted by law, our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim arose, and we are not liable for indirect or consequential loss (including lost business or profits arising from quote errors).",
          ],
        },
        {
          heading: "9. Termination",
          paragraphs: [
            "You may close your account at any time. We may suspend or terminate accounts that breach these Terms, with notice where reasonable. On termination, your right to use the Service ends; you may request an export of your data beforehand.",
          ],
        },
        {
          heading: "10. General",
          paragraphs: [
            "These Terms are governed by the laws of New South Wales, Australia. If any provision is found unenforceable, the remainder continues in effect. We may update these Terms; material changes will be notified in the app or by email.",
          ],
        },
      ]}
    />
  );
}
