# QuoteCraft — Consolidated Requirements Document

**Version:** 1.0
**Date:** 25 June 2026
**Status:** Draft for build sign-off

---

## 1. Overview

QuoteCraft is a mobile-friendly web application for creating dynamic Australian
business quotes. It combines AI natural-language parsing, voice control,
Australian tax rules (10% GST, call-out fees, public holiday surcharge), and
template save/load.

This document consolidates all reported bugs and requested enhancements into a
single specification, groups them into the **minimum number of build
iterations**, and defines the **expected UI** for each.

> **Key decision (this revision):** The app **keeps TWO microphone icons** — one
> for *initial quote generation*l and one for *making changes to an existing
> quote*. They are intentional and distinct, **not** duplicates to be merged.

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
> controls** with distinct purposes.

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
- **Original request superseded.** Instead of removing a mic, ensure the **two
  mics are visually and functionally distinct** (separate placement, labels,
  tooltips per §3) so neither looks like an accidental duplicate.
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
- When the user requests a PDF, show a frontend form with:
  - **Logo upload** (optional, top-left corner of PDF)
  - **Contact name** (mandatory)
  - **Mobile** (pre-populated from registration — see dependency §6)
  - **Email** (pre-populated from registration — see dependency §6)
  - **ABN** (optional; if present, show in PDF header)
  - **ACN** (optional; if present, show in PDF header)
- Generated PDF includes all quote details, GST breakdown, and footer:
  *"Thank you for your business! We are looking forward to hearing from you!"*
- **Acceptance:** PDF renders all fields, GST, optional logo/ABN/ACN, and the
  footer message.

### Enhancement #5 — User registration with mobile & email verification
- **Fields:** full name, email, mobile (Australian format `04XX XXX XXX`),
  password (min 8 chars, must include a number and a letter).
- **Dual verification:** send a **6-digit OTP** to **both** email and mobile;
  **both must be verified** before access is granted.
- **SMS:** via Twilio (external account + per-message cost — see §7).
- **Rate limiting:** 3 attempts per 15 minutes.
- **OTP expiry:** 10 minutes.
- **Auto-submit** when 6 digits are entered.
- **Clear error messages** for duplicates, invalid format, expired/incorrect OTP.
- **Passwords hashed with bcrypt; sessions via JWT.**
- **Marketing-consent checkbox** (unticked by default) captured at registration
  for future promotions (see §8 compliance).
- **Post-verification:** show a **welcome screen** with a **dashboard**
  displaying the user's **saved templates** and **quote history**.
  - *Note:* quote history is **net-new persistence** — requires a new table and
    save-on-create wiring.
- **Acceptance:** A user cannot access the app until both channels are verified;
  rate limits and expiry enforced; passwords never stored in plain text.

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

### 🟨 Iteration 3 — User Registration & Auth
- Enhancement #5 (registration, dual OTP, bcrypt, JWT, dashboard)
- Marketing-consent checkbox
- **Best phased internally:** (a) core auth + email OTP → (b) Twilio SMS + dual
  verification + rate limiting → (c) welcome/dashboard + quote-history
  persistence.

### 🟧 Iteration 4 — Branded PDF Export
- Enhancement #2
- **Why last:** mobile/email fields pre-populate from registration (Iteration 3).
  *Optional compression:* if manual entry is acceptable, this can fold into
  Iteration 2, reducing the plan to **3 iterations**.

### Dependencies
- **Bug #6** true per-user uniqueness depends on Iteration 3 (enforced globally
  until then).
- **Enh #2** pre-population depends on Iteration 3.
- **Quote history** (dashboard) is new persistence introduced in Iteration 3.

---

## 7. Data Storage & Architecture

Two auth paths are possible. Given the **mobile/SMS requirement** (not supported
by Replit's managed Clerk auth), client contact data will reside in **your own
database** in either path.

| Data | Custom build (Twilio) | Hybrid (Clerk + Twilio) |
|------|----------------------|--------------------------|
| Full name | Your PostgreSQL | Clerk |
| Email + email verification | Your PostgreSQL | Clerk |
| Password (hashed, bcrypt) | Your PostgreSQL | Clerk (you never handle it) |
| **Mobile number** | Your PostgreSQL | **Your PostgreSQL** (Clerk can't store it) |
| Mobile OTP + status | Your PostgreSQL | Your PostgreSQL |
| Templates & quote history | Your PostgreSQL | Your PostgreSQL |

- **Development** and **production** use **separate databases** automatically.
- **Production** is queryable **read-only** via SQL (SELECT) for support/analytics.
- You retain **full visibility and access** to client data (names, emails,
  mobiles) — usable for future promotions, subject to §8.

### External services required for Iteration 3/4
- **Twilio** — SMS OTP (account, AU sender registration, per-SMS cost).
- **Email sender** (e.g. SendGrid/Resend) — email OTP delivery.

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

---

## 10. Open Questions for Sign-off

1. **Auth path:** full custom build, or **hybrid** (managed Clerk for
   email/password/sessions + Twilio for mobile OTP)? Hybrid reduces
   security-sensitive code.
2. **PDF timing:** keep PDF as Iteration 4 (pre-populated from registration), or
   compress into Iteration 2 with manual entry (→ 3 iterations total)?
3. **Email provider** preference for OTP delivery?
4. **Quote history:** confirm quotes should be persisted per user (new storage)
   for the dashboard.
