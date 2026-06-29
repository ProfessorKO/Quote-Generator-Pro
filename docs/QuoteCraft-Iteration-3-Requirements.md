# QuoteCraft — Iteration 3 Product Requirements

**Iteration:** 3 — User Registration & Auth (Clerk) + Dashboard
**Status:** Specification (not yet built)
**Date:** 28 Jun 2026
**Depends on:** Iterations 1 & 2 (DONE)
**Source of truth for cross-iteration context:** `docs/QuoteCraft-Requirements-v4.0.md`
(This file is a standalone, build-ready expansion of §2A, Enhancement #5, the Email
Templates section, and §7 of v4.0. The consolidated v4.0 doc is intentionally **not**
modified.)

---

## 1. Objective

Turn QuoteCraft from a fully anonymous tool into a **try-before-you-register**
product:

- Quoting (voice/text generation + live recalculation) stays **free and ungated**.
- The **first time** a user tries to **Save**, **Download PDF**, or **Email to
  client**, they must **create a Clerk account and verify their email** before the
  action completes.
- Registration captures the **business profile** (business name, ABN, address) that
  will **pre-populate the branded PDF** in Iteration 4.
- After verifying, the user lands on a **welcome dashboard** showing their **saved
  templates** and **quote history**, and is **returned to finish the exact action**
  they triggered — without losing the in-progress quote.

**Definition of done:** anonymous users can generate quotes; save/download/email are
blocked until email is verified; after verifying the user resumes their action with
the quote intact; quote history persists per user; the app never handles raw
passwords.

---

## 2. Build Phases (internal sequencing)

| Phase | Scope | Gate to next phase |
|-------|-------|--------------------|
| **3a — Auth core** | Clerk integration, sign-up/sign-in, email-OTP verification, session wiring, marketing-consent capture. | A user can register, verify email, and stay logged in across reloads. |
| **3b — Gating** | Intercept Save / Download / Email for anonymous users → auth modal → resume original action with quote preserved. | All three actions are blocked when logged out and resume correctly after verify. |
| **3c — Persistence & dashboard** | Business-profile storage, quote-history table + save-on-create wiring, per-user templates, welcome/dashboard screen. | Dashboard shows the user's templates + quote history; new quotes are recorded. |

---

## 3. Access & Gating Model

### 3.1 Anonymous (no account)
- **Allowed:** generate an initial quote (Mic 1 voice or text), edit via Mic 2,
  adjust line items/settings, see live totals (subtotal, GST, call-out, surcharge,
  overtime, grand total).
- **Blocked:** Save template, Download PDF, Email to client.

### 3.2 Gated actions (require Clerk account + verified email)
| Action | Trigger | Behaviour when logged out |
|--------|---------|---------------------------|
| **Save** (template/quote) | Save button / "save template" voice command | Open auth modal; on success, complete the save. |
| **Download PDF** | Download button | Open auth modal; on success, run the export. |
| **Email to client** | Email button | Open auth modal; on success, proceed to email flow. |

### 3.3 Gating rules
- The **in-progress quote must survive** the auth round-trip (line items, settings,
  description, business name). Persist to `sessionStorage`/`localStorage` under a
  stable key before opening the modal; rehydrate and **auto-resume** the original
  action after verification.
- A user who is **logged in but not yet email-verified** is treated as **not
  entitled** — the same gate applies until verification completes.
- After a successful gate pass, **do not re-prompt** for the rest of the session.

---

## 4. Authentication (Clerk) — Settings & Parameters

> Provider: **Replit-managed Clerk** (see the `clerk-auth` skill for setup). The app
> never stores or hashes passwords; sessions/tokens are Clerk-managed. No custom JWT.

| Setting | Value | Notes |
|---------|-------|-------|
| Auth method | **Email + password** | SSO (Google/Apple) may be added later; not in this iteration. |
| Verification | **Email OTP only** | No SMS/Twilio, no dual verification. |
| OTP format | **6-digit code** | Emailed at sign-up. |
| OTP expiry | **10 minutes** (Clerk default) | **Must be stated in the verification email.** |
| Resend cooldown | **30–60 s** | Separate from the 10-min code expiry; "Resend code" disabled until cooldown ends. |
| Password policy | **Min 8 characters** (Clerk policy) | Enforced + hashed by Clerk. |
| Rate limiting / bot protection | **Handled by Clerk** | No app-side implementation. |
| Session persistence | **Clerk session** | Survives reload/navigation; used to evaluate the gate. |
| Sign-out | Available from dashboard/profile menu | Clears Clerk session. |

### 4.1 Registration fields
| Field | Required | Stored in | Validation |
|-------|----------|-----------|------------|
| Full name | Yes | Clerk | Non-empty. |
| Email | Yes | Clerk | Valid email; verified via OTP. |
| Password | Yes | Clerk (hashed) | Min 8 chars (Clerk). App never sees raw value. |
| **Business name** | Yes | PostgreSQL (business profile) | Non-empty; pre-populates PDF. |
| **ABN** | Yes | PostgreSQL | 11 digits (format check; not authoritative ABR validation). |
| **Address** | Yes | PostgreSQL | Free text (Enh #6 verified lookup is deferred). |
| **Marketing consent** | No | PostgreSQL (or Clerk metadata) | **Checkbox, unticked by default** (AU Spam Act 2003). |

---

## 5. Email Templates & Sender (Clerk)

- **Sender (default, dev + launch):** From name **"QuoteCraft"** via Clerk's shared
  sending domain. No setup required.
- **Sender (branded, optional production):** add a custom email domain in Clerk +
  DNS (DKIM / SPF / CNAME), e.g. `noreply@quotecraft.com.au`.
- Templates are edited in **Clerk's dashboard email template editor**. `{{...}}` are
  Clerk variables (confirm exact names in the editor).

**Verification email (at sign-up)**
> **Subject:** Your QuoteCraft verification code
> Hi {{user.first_name}}, enter this code to verify your email: **{{otp_code}}**.
> **This code expires in 10 minutes.** If you didn't sign up, ignore this email.

**Welcome email (after verification)**
> **Subject:** Welcome to QuoteCraft
> Lists what they can now do (quotes by voice/text, save templates, branded PDFs)
> with an **[ Open QuoteCraft ]** → {{app_url}} button.

---

## 6. Dashboard (post-verification)

A **welcome screen / dashboard** shown after verification and reachable any time
while logged in.

| Section | Content | Source |
|---------|---------|--------|
| Welcome header | Greeting with first name + business name | Clerk + business profile |
| **Saved templates** | List of the user's templates; open/edit/delete | PostgreSQL (per-user) |
| **Quote history** | List of generated/saved quotes (date, client/label, total) | PostgreSQL (new table) |
| Quick actions | "New quote", "Open templates", account/sign-out | — |

- Empty states: friendly prompts ("No quotes yet — create your first quote").
- Templates uniqueness becomes **per-user** in this iteration (global rule from
  Iteration 2 is the interim; see Dependencies).

---

## 7. Data Storage & Architecture

| Data | Where it lives |
|------|----------------|
| Full name, email, email verification, password (hashed), sessions/tokens | **Clerk** |
| Business profile (business name, ABN, address, optional logo) | **PostgreSQL** |
| Marketing-consent flag | **PostgreSQL** (or Clerk metadata) |
| Templates (now per-user) | **PostgreSQL** |
| **Quote history (net-new)** | **PostgreSQL** |
| Mobile number (optional, per PDF export — Iteration 4) | **PostgreSQL** (only if provided) |

### 7.1 New persistence (proposed)
- **`business_profiles`** — one row per user: `userId` (Clerk id), `businessName`,
  `abn`, `address`, `logoUrl?`, `marketingConsent` (bool), timestamps.
- **`quotes`** (quote history) — `id`, `userId`, `label`/client, `lineItems`
  (json), `settings` (json), computed `total`, `createdAt`.
- **Templates** — add `userId`; uniqueness scope changes to **per-user**
  case-insensitive (replacing the interim global unique index).
- Save-on-create wiring records a quote to history when the user saves/downloads/
  emails (confirm exact trigger — see Open Questions).
- Dev and production use **separate databases** automatically; production is
  read-only queryable for support/analytics.

---

## 8. Detailed User Flows

### Flow A — Anonymous quote → first gated action → register → resume
1. User opens app (logged out) → **Home**.
2. Generates a quote by voice (Mic 1) or text → reviews live totals. *(ungated)*
3. Optionally edits via Mic 2 / numeric inputs. *(ungated)*
4. Taps **Save / Download / Email** → **gate triggers**.
5. App **saves the in-progress quote** to storage and opens the **Auth modal**.
6. User chooses **Sign up** → enters full name, email, password, **business name,
   ABN, address**, optional **marketing consent** (unticked).
7. Clerk emails a **6-digit OTP** (expires in 10 min).
8. User enters the code (can **Resend** after 30–60 s cooldown).
9. On verify → **Welcome email** sent → user sees **Welcome/Dashboard** (or returns
   inline) and the app **auto-resumes the original action** with the quote intact.
10. Action completes (template saved / PDF downloaded / email flow proceeds).

### Flow B — Returning user (already verified)
1. Opens app → Clerk session active → no gate on save/download/email.
2. Dashboard available with templates + quote history.

### Flow C — Logged-in but unverified
1. Triggers a gated action → still blocked → prompted to **verify email** (resend
   available) → on verify, resumes action.

### Flow D — Cancel / abandon at gate
1. User closes the Auth modal without finishing → returns to Home with the quote
   **unchanged and intact** → no save/export performed.

---

## 9. Acceptance Criteria

- [ ] Anonymous users can fully generate and edit a quote (no account needed).
- [ ] Save, Download PDF, and Email are each blocked until **email is verified**.
- [ ] In-progress quote (line items, settings, description, business name) survives
      the auth round-trip and the original action **auto-resumes** after verify.
- [ ] OTP is 6 digits, expires in **10 minutes**, and the expiry is **stated in the
      email**; resend respects a 30–60 s cooldown.
- [ ] Passwords are never handled/stored by the app (Clerk only).
- [ ] Registration captures business name, ABN, address + optional marketing consent
      (unticked by default) and persists them to PostgreSQL.
- [ ] Dashboard shows the user's saved templates and quote history with empty states.
- [ ] Quote history persists per user (new table + save-on-create wiring).
- [ ] Cancelling the auth modal leaves the quote intact and performs no action.

---

## 10. Dependencies & Downstream

- **Bug #6** template-name uniqueness becomes **per-user** here (was enforced
  globally in Iteration 2 as the interim).
- **Enhancement #2 (Branded PDF, Iteration 4)** pre-populates from the business
  profile captured in this iteration.
- **Quote history** is net-new persistence introduced here.
- **Enhancement #6 (address lookup/validation)** is independent and **deferred** —
  address remains free-text in this iteration.

---

## 11. Open Questions for Sign-off

1. **Quote-history trigger:** record a quote to history on **Save only**, or also on
   **Download/Email** (and/or on first generation)?
2. **Dashboard placement:** dedicated route/screen after verify, or an inline panel
   the user can dismiss to resume their action?
3. **ABN validation depth:** format-only (11 digits) for now, or schedule
   authoritative ABR lookup later?
4. **Branded sender:** use the default Clerk sender, or set up a custom email domain
   (`quotecraft.com.au`) now?
5. **Templates migration:** how to treat existing global templates when per-user
   ownership is introduced (assign to first owner / keep shared / archive)?
