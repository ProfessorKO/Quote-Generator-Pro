# QuoteCraft — Consolidated Requirements Document

**Version:** 3.0
**Date:** 28 June 2026
**Status:** Draft for build sign-off

---

## Document Versioning & Change Tracking

This is a **single living document**. The filename carries the current version
(`QuoteCraft-Requirements-v3.0.md`) and is renamed on each version bump. The
**Changelog** below records what changed per version, and changes are marked
**inline** so the full decision history stays visible.

### Legend (tracked changes)

| Notation | Meaning |
|----------|---------|
| <mark>highlighted text</mark> | **Added or changed** in the current version (v3.0). |
| ~~struck-through text~~ | **Removed** in the noted revision — kept visible for history, not active. |
| *(removed vX.0)* | Tag after struck text saying which version dropped it. |
| *(new v3.0)* / *(changed v3.0)* | Tag marking current-version additions/edits. |

### Changelog

| Version | Date | Summary |
|---------|------|---------|
| **v1.0** | 25 Jun 2026 | Initial consolidated spec — all bugs + enhancements, **two-mic** model, Australian tax rules (10% GST, call-out fee, public-holiday surcharge), template save/load, build iterations. |
| **v2.0** | 27 Jun 2026 | **Auth pivot:** adopted **Replit-managed Clerk** with **email verification only**. ~~Removed mobile/SMS verification, Twilio, and dual (email+SMS) verification.~~ Added *Email Templates & Sender* section (verification + welcome emails, 10-min OTP expiry, default vs branded custom-domain sender). |
| **v3.0** | 28 Jun 2026 | **Try-before-register access model** (§2A): anonymous users can generate quotes; registration is gated **only** at Save / Download / Email. Registration now captures **business name, ABN, address** to pre-populate the PDF. **PDF mobile field** changed to a fixed **`+61 4`** prefix + **8 digits**. ~~Removed the PDF "phone" field~~ and ~~the earlier `+61` + 10-digit-starting-`04` mobile rule~~. Added an **AU address-lookup** future-enhancement note. Introduced this versioning + change-tracking system. |

---

## 1. Overview

QuoteCraft is a mobile-friendly web application for creating dynamic Australian
business quotes. It combines AI natural-language parsing, voice control,
Australian tax rules (10% GST, call-out fees, public holiday surcharge), and
template save/load.

This document consolidates all reported bugs and requested enhancements into a
single specification, groups them into the **minimum number of build
iterations**, and defines the **expected UI** for each.

> **Key decision:** The app **keeps TWO microphone icons** — one for *initial
> quote generation* and one for *making changes to an existing quote*. They are
> intentional and distinct, **not** duplicates to be merged.

---

## 2. Current System Context

| Area | Current state |
|------|---------------|
| Frontend | React + Vite (`artifacts/quotecraft`), mobile-friendly |
| Backend | Express 5 API (`artifacts/api-server`), routes mounted under `/api` |
| Database | Replit-managed PostgreSQL (Drizzle ORM); tables: `templates`, `conversations`, `messages` |
| AI parsing | `/api/parse-quote` — turns a job description into a quote form |
| AI voice edits | `/api/apply-voice-command` — applies spoken changes to an existing quote |
| Voice input | Web Speech API via `use-speech.ts` hook |
| Authentication | **None today** — no users table, no login |
| Quote history | **Not persisted today** — quotes are not saved per user |

---

## 2A. Access & Gating Model *(new v2.0 · refined v3.0)*

QuoteCraft is **try-before-you-register**:

- **Anonymous use (no account):** A first-time / unregistered user **can generate
  an initial quote by voice or text** (Mic 1) and see the calculated result.
  Quoting is **free and ungated**.
- ~~Registration gates access to the app from the start (users must sign up before
  generating any quote).~~ *(removed v3.0 — replaced by try-before-register above)*
- **Registration gate:** An account (**Clerk, email-verified**) is required the
  moment the user clicks **Save**, **Download PDF**, or **Email to client**.
  These actions are blocked until the user registers/logs in and verifies email.
- **Why:** capture the lead and business profile exactly when the user gets value
  (a finished quote they want to keep or send).
- <mark>**Registration captures the business profile** — **business name, ABN,
  address** (plus full name + email) — which **pre-populate the PDF** so exports
  are branded without re-typing.</mark> *(new v3.0)*
- After registering, the user is **returned to complete the action they tried**
  (save/download/email) without losing the in-progress quote.

---

## 3. Microphone Model (Expected UI) — TWO DISTINCT MICS

The product uses two purpose-built microphones. Each has a clear, separate role,
distinct placement, and its own label/tooltip so users never confuse them.

### 🎙️ Mic 1 — "Generate Quote" (Initial Quote Generation)
- **Purpose:** Dictate a job description to create the initial quote.
- **Backend:** `/api/parse-quote`.
- **Placement:** Inside the description input box, bottom-right corner (current
  location retained).
- **Label / tooltip:** *"Describe your job out loud to generate a quote."*
- **States:** idle (secondary) → listening (red, pulsing animation) → processing
  (disabled + spinner).

### 🎙️ Mic 2 — "Edit Quote" (Changes to Existing Quote)
- **Purpose:** Speak adjustments to an already-generated quote (quantity, unit
  price, rename, delete, add items, discounts, settings).
- **Backend:** `/api/apply-voice-command`.
- **Placement:** Floating button, **fixed on the right side of the screen,
  always visible while scrolling** (sticky).
- **Label / tooltip:** *"Speak to make changes to quantity, unit price or even
  the quote structure."*
- **States:** idle → listening (pulsing animation) → processing (locked screen,
  see §4 Bug #5).

> Both mics share the same visual language (pulse when listening, spoken
> confirmation, screen lock during processing) but remain **two separate
> controls** with distinct purposes. ~~Earlier request: merge the two mics into a
> single microphone.~~ *(removed v1.0 — superseded by the two-distinct-mics
> decision; see Bug #4.)*

---

## 4. Bug Requirements

### Bug #1 — Voice confirmation on recalculation
- After a quote is recalculated, speak **"Quote updated"** via speech synthesis
  and show a toast notification.
- **Debounce** the spoken confirmation so rapid successive changes don't
  overlap or interrupt each other.
- **Acceptance:** Make 3 quick voice edits → only one (final) spoken
  confirmation; toast shows for each committed change.

### Bug #2 — Numeric input UX
- On focus/tap into any numeric field, **auto-select all text** so the user can
  type over it.
- If the user leaves a numeric field **empty**, **restore the previous value**
  (no blank/NaN states).
- **Acceptance:** Tapping a price field selects its contents; clearing and
  blurring restores the prior number.

### Bug #3 — Disable generation during voice processing *(merged into Bug #5)*
- While Mic 1 voice is being processed, the **"Generate Quote Form"** button
  shows a loading state (*"Processing voice…"*) and is disabled until
  recognition completes or fails.
- Implemented as part of the screen-lock behaviour in Bug #5.

### Bug #4 — Microphone clarity *(REVISED — do NOT merge to one mic)*
- **Original request superseded.** ~~Remove one microphone so the screen shows a
  single mic.~~ *(removed v1.0)* Instead of removing a mic, ensure the **two mics
  are visually and functionally distinct** (separate placement, labels, tooltips
  per §3) so neither looks like an accidental duplicate.
- **Acceptance:** A first-time user can tell which mic creates a quote vs. which
  edits it, without instruction.

### Bug #5 — Screen lock during voice processing
- While voice is being processed, show a **full-screen overlay** with a spinner
  and *"Processing voice…"*.
- **Disable all interactions:** buttons, inputs, and scrolling.
- **Auto-unlock** when processing completes or errors.
- **30-second timeout** safeguard to prevent an infinite lock.
- Applies to **both** mics.
- **Acceptance:** During processing the UI is non-interactive; it always unlocks
  within 30s even on failure.

### Bug #6 — Prevent duplicate template names
- Before saving a template, check whether a template with the same name already
  exists **(globally for now; per-user once auth lands — see §6 dependency).**
- If a duplicate is found: stop the save, show error *"A template named
  [Template Name] already exists. Please choose a different name."*
- **Auto-select** the name field for quick renaming.
- **Voice feedback:** *"A template with that name already exists. Please say a
  different name."*
- **Acceptance:** Saving a duplicate name is blocked with the exact message and
  the name field is focused/selected.

---

## 5. Enhancement Requirements

### Enhancement #1 + #4 — Loading speed & performance *(merged)*
- Code splitting via `React.lazy()` + `Suspense`.
- Immediate loading spinner on first paint; **skeleton loading screens**.
- **Progress bars** during longer operations.
- Render line items **progressively** as they are parsed.
- **Debounce calculations** (300 ms).
- **Cache templates in `localStorage`.**
- Tune voice recognition for speed (`continuous=false`, `interimResults=true`).
- `preconnect` to external APIs; optimise bundle size.
- Track performance metrics and log slow steps.
- **Acceptance:** Measurable first-load improvement; skeletons appear instantly;
  calculations no longer fire on every keystroke.

### Enhancement #2 — Branded PDF export
- **Pre-populated from the registered business profile** (§2A): **business name,
  ABN, address, email** — editable, shown in the PDF header.
- When the user requests a PDF, show a frontend form with:
  - **Logo upload** (optional, top-left corner of PDF)
  - **Contact name** (mandatory)
  - ~~**Phone** field shown in the PDF header.~~ *(removed v3.0)*
  - ~~**Mobile** *(optional)* — a fixed **`+61`** prefix is shown; the user types
    the remaining **10 digits**, which **must start with `04`**.~~ *(removed
    v3.0 — replaced below)*
  - <mark>**Mobile** *(optional)* — **frontend-validated**: a fixed **`+61 4`**
    prefix is shown on the leading edge of the field; the user types **only the
    remaining 8 digits**. Displayed/exported as `+61 4 XXXX XXXX`. If blank, it is
    omitted from the PDF; if entered, all 8 digits must be present before export.</mark>
    *(changed v3.0)*
  - **ABN** (optional override; if present, show in PDF header)
  - **ACN** (optional; if present, show in PDF header)
- Generated PDF includes all quote details, GST breakdown, and footer:
  *"Thank you for your business! We are looking forward to hearing from you!"*
- **Acceptance:** PDF renders all fields, GST, optional logo/ABN/ACN, and the
  footer message.

### Enhancement #5 — User registration with email verification (Clerk)
- **Auth provider:** **Replit-managed Clerk**. Email + password sign-up with
  **email verification** only. ~~Mobile/SMS verification via Twilio.~~ *(removed
  v2.0 — no Twilio.)* ~~Dual verification (email **and** SMS).~~ *(removed v2.0.)*
  SSO (Google/Apple/etc.) can be enabled later if desired.
- **Fields:** full name, **business name, ABN, address** (these pre-populate the
  PDF), email, password (Clerk password policy, min 8 chars).
- **Email verification:** a **6-digit OTP** is emailed at sign-up and **must be
  verified** before any **save / download / email** action completes (see §2A —
  quote *generation* itself needs no account).
- **OTP expiry:** **10 minutes** (Clerk default). This expiry **must be clearly
  stated in the verification email** (see *Email Templates & Sender* below).
- **Resend cooldown:** short timer (~30–60s) before "Resend code" re-enables —
  this is **separate** from the 10-minute code expiry.
- **Rate limiting / bot protection:** handled by Clerk.
- **Passwords:** managed and hashed by **Clerk** — the app never stores or
  handles raw passwords (no custom bcrypt). **Sessions/tokens** are Clerk-managed
  (no custom JWT needed).
- **Marketing-consent checkbox** (unticked by default) captured at registration
  for future promotions; stored in your PostgreSQL or Clerk metadata (see §8).
- **Post-verification:** show a **welcome screen** with a **dashboard**
  displaying the user's **saved templates** and **quote history**.
  - *Note:* quote history is **net-new persistence** — requires a new table and
    save-on-create wiring.
- **Acceptance:** Anonymous users can generate a quote; **save/download/email are
  blocked until email is verified**; after verifying, the user resumes the exact
  action they triggered; code expiry is enforced **and stated in the email**;
  passwords are never handled by the app.

### Enhancement #6 — Australian address lookup/autocomplete <mark>*(new v3.0 — future option, not in current build)*</mark>

<mark>There is **no native/built-in** Australian address-validation API in the
platform, and AI models (OpenAI/Gemini/Anthropic) can *format* an address but
**cannot authoritatively validate** it against the Australia Post database (risk
of plausible-but-fake addresses). Real autocomplete/validation requires an
**external service with an API key**:</mark>

- <mark>**Australia Post APIs** / **Addressify** — built on the official AusPost
  PAF dataset (most "Australian-correct").</mark>
- <mark>**Google Places Autocomplete** — global, fast, common for type-ahead.</mark>
- <mark>**Loqate / Melissa** — enterprise-grade global validation.</mark>

<mark>**Recommendation:** Google Places Autocomplete for the typing experience, or
Addressify for AusPost-verified data. Deferred — to be scheduled as its own
iteration if/when address verification is required for the registration address
and PDF header.</mark>

### Email Templates & Sender (Clerk) *(new v2.0)*

**Where are the verification / welcome emails sent from?**
Auth emails are sent by **Clerk's email service** — the app does **not** run its
own SMTP or a separate vendor (SendGrid/Resend) for these.
- **Default (dev + launch):** From name **"QuoteCraft"** via Clerk's shared
  sending domain (a Clerk-hosted address). No setup required.
- **Branded (recommended for production):** add a **custom email domain** in
  Clerk and configure DNS (**DKIM / SPF / CNAME**) so emails send from your own
  domain, e.g. `noreply@quotecraft.com.au`. Requires owning the domain.
- **Editing:** these templates are configured in **Clerk's dashboard email
  template editor**. The copy below is what to paste in; `{{...}}` are Clerk
  template variables (exact names are confirmed in the editor).

**1) Email verification (code) — sent at sign-up**

> **Subject:** Your QuoteCraft verification code
>
> Hi {{user.first_name}},
>
> Welcome to QuoteCraft. Enter this code to verify your email address:
>
> **{{otp_code}}**
>
> **This code expires in 10 minutes.** If it expires, request a new one from the
> app.
>
> If you didn't try to sign up, you can safely ignore this email.
>
> — The QuoteCraft Team

**2) Welcome email — sent after the email is verified**

> **Subject:** Welcome to QuoteCraft
>
> Hi {{user.first_name}},
>
> Your QuoteCraft account is ready. You can now:
>
> - Create professional quotes by voice or text
> - Save reusable templates for jobs you do often
> - Export branded PDF quotes to send straight to clients
>
> **[ Open QuoteCraft ]** → {{app_url}}
>
> Need a hand getting started? Just reply to this email.
>
> — The QuoteCraft Team

---

## 6. Recommended Build Iterations (minimum count)

Grouped by shared code surface and dependency so the same files aren't reopened
repeatedly.

### 🟦 Iteration 1 — Dual-Mic Voice System
- Bug #1 (voice confirmation, debounced)
- Bug #3 + Bug #5 (screen lock + disable during processing + 30s timeout)
- Bug #4 (two distinct, clearly-labelled mics per §3)
- Voice-recognition speed tuning (pulled from Enh #4)
- **Why together:** all touch the mic flow / `home.tsx` / `use-speech.ts`.

### 🟩 Iteration 2 — Quick Fixes + Performance
- Bug #2 (numeric input)
- Bug #6 (duplicate template names — global enforcement for now)
- Enhancement #1 + #4 (loading & performance)
- **Why together:** independent, low-risk, no auth dependency.

### 🟨 Iteration 3 — User Registration & Auth (Clerk)
- Enhancement #5 (Clerk email/password + email-OTP verification, dashboard)
- Marketing-consent checkbox
- Configure Clerk email templates (verification + welcome) incl. the **10-minute
  expiry** note; *(optional, production)* custom email domain for a branded sender
- **Best phased internally:** (a) Clerk auth + email verification → (b)
  welcome/dashboard + quote-history persistence.

### 🟧 Iteration 4 — Branded PDF Export
- Enhancement #2
- **Why last:** business-profile fields pre-populate from registration (Iteration 3).
  *Optional compression:* if manual entry is acceptable, this can fold into
  Iteration 2, reducing the plan to **3 iterations**.

### Dependencies
- **Bug #6** true per-user uniqueness depends on Iteration 3 (enforced globally
  until then).
- **Enh #2** pre-population depends on Iteration 3.
- **Quote history** (dashboard) is new persistence introduced in Iteration 3.
- <mark>**Enh #6** (address lookup) is independent and deferred; can be scheduled
  any time after Iteration 3.</mark> *(new v3.0)*

---

## 7. Data Storage & Architecture

Auth is handled by **Replit-managed Clerk** (email + password with email
verification). Clerk stores identity/auth data; your **PostgreSQL** stores all
app data and the business-profile fields used on quotes/PDFs.

| Data | Where it lives |
|------|----------------|
| Full name, email, email verification | Clerk |
| Password (hashed) | Clerk — app never handles it |
| Session / tokens | Clerk |
| Marketing-consent flag | Your PostgreSQL (or Clerk metadata) |
| ~~Business profile incl. **phone**~~ → Business profile (business name, ABN, address, logo) for branding | Your PostgreSQL |
| <mark>Mobile — **optional**, entered per PDF export (not part of registration)</mark> | Your PostgreSQL (only if provided) |
| Templates & quote history | Your PostgreSQL |

- **Development** and **production** use **separate databases** automatically.
- **Production** is queryable **read-only** via SQL (SELECT) for support/analytics.
- You retain access to user **names/emails** (via the Clerk dashboard/API) and
  all app data — usable for future promotions, subject to §8.

### External services required for Iteration 3/4
- **Clerk** (Replit-managed) — auth **and** delivery of verification/welcome
  emails. No separate email vendor is required for auth emails. *(Optional)*
  custom email domain + DNS for a branded sender.
- ~~**Twilio / SMS** for mobile verification.~~ *(removed v2.0 — mobile
  verification was dropped.)*
- <mark>*(Optional, Enh #6)* an address-lookup provider (Google Places / Addressify
  / Australia Post) — only if address autocomplete/validation is scheduled.</mark>
  *(new v3.0)*

---

## 8. Compliance & Legal Notes

- **Infrastructure:** Replit holds **SOC 2 Type II** attestation; hosting on
  Google Cloud (US), which is **ISO 27001 and SOC 2 Type 2** certified. Data at
  rest is **AES-256** encrypted.
- **App-level compliance is separate:** building on compliant infrastructure
  does **not** automatically make the app certified. Formal ISO/SOC compliance
  is an organisational/audit process. Verify current certificates on the
  providers' trust pages.
- **Marketing email (AU Spam Act 2003):** requires (1) consent, (2) sender
  identification, (3) a working unsubscribe. Registration must include a
  **separate, unticked marketing-consent checkbox**; app usage alone is not
  consent to promotions.
- *Not legal advice — confirm specifics with a qualified professional.*

---

## 9. Out of Scope / Assumptions

- Native iOS / Android store apps (this is a web app; store distribution would
  require wrapping or a native rebuild).
- Sending the actual promotional campaigns (requires a connected email service;
  separate task).
- Payment processing / invoicing beyond quote PDF generation.
- <mark>Address autocomplete/validation (Enh #6) — out of the current build;
  deferred to a future iteration.</mark> *(new v3.0)*

---

## 10. Open Questions for Sign-off

1. ~~**Auth path**~~ — **Resolved (v2.0):** Replit-managed **Clerk**, **email
   verification only** (no mobile/SMS).
2. **PDF timing:** keep PDF as Iteration 4 (pre-populated from saved business
   profile), or compress into Iteration 2 with manual entry (→ 3 iterations total)?
3. ~~**Email provider for OTP**~~ — **Resolved (v2.0):** handled by **Clerk**
   (optional custom email domain for a branded sender in production).
4. **Quote history:** confirm quotes should be persisted per user (new storage)
   for the dashboard.
5. **Branded sender:** do you own a domain (e.g. `quotecraft.com.au`) you'd like
   verification/welcome emails sent from, or is the default Clerk sender fine for
   now?
6. ~~**Mobile format:** `+61` prefix **plus** a 10-digit number starting `04`,
   or strict E.164 `+61 4XX XXX XXX`?~~ — <mark>**Resolved (v3.0):** fixed
   **`+61 4`** prefix shown in the field; user enters **8 digits**; exported as
   `+61 4 XXXX XXXX`.</mark>
7. <mark>**Address lookup (Enh #6):** is verified/auto-completed address entry
   wanted (needs an external provider + key), or is free-text address sufficient
   for now?</mark> *(new v3.0)*
