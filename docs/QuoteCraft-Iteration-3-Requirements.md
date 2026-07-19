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
| **3c — Persistence & dashboard** | Business-profile storage, quote-history + email-history tables + save-on-create wiring, template edit/delete, Settings/Profile page, dedicated dashboard with history filters, client emailing. | Dashboard shows templates + quote/email history with filters; new quotes are recorded; profile is editable. |

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
| Field | Type | Required | Stored in | Validation |
|-------|------|----------|-----------|------------|
| **First name** | string | Yes | Clerk (`firstName`) | Non-empty; **max 50 characters**. |
| **Surname** (last name) | string | Yes | Clerk (`lastName`) | Non-empty; **max 50 characters**. |
| Email | string | Yes | Clerk | Valid email; verified via OTP. |
| Password | string | Yes | Clerk (hashed) | Min 8 chars (Clerk). App never sees raw value. |
| **Business name** | string | Yes | PostgreSQL (business profile) | Non-empty; pre-populates PDF. |
| **Mobile** | string | Yes | PostgreSQL (business profile) | Fixed **`+61-4`** prefix shown in the field (read-only); user enters the **remaining 8 digits**. Stored/exported as `+61 4 XXXX XXXX`. See §4.2. |
| **ABN** | string | Yes | PostgreSQL | 11 digits (format check; not authoritative ABR validation). |
| **Address** | string | Yes | PostgreSQL | Free text (Enh #6 verified lookup is deferred). |
| **Marketing consent** | boolean | No | PostgreSQL (or Clerk metadata) | **Checkbox, unticked by default** (AU Spam Act 2003). |

> **Australian-English note:** the name is split into **First name** + **Surname**
> (AU convention; "Surname" preferred over "Last name", though either label is
> acceptable in the UI). Both map to Clerk's `firstName` / `lastName`. Clerk's
> "full name" is derived as `First name + Surname`.

### 4.2 Mobile field — format & rules
- **Prefix:** a fixed, **read-only `+61-4`** is rendered to the left of the input so
  every number is an Australian mobile. The user **cannot edit the prefix**.
- **User entry:** exactly **8 digits** (the part after the leading `4`). Strip
  spaces/non-digits on input; reject if not exactly 8 digits.
- **Stored value:** normalise to **`+61 4 XXXX XXXX`** (or E.164 `+614XXXXXXXX`
  internally) so it is consistent with the planned PDF format (Iteration 4).
- **Display/export:** shown on the dashboard/profile and pre-populates the branded
  PDF header in Iteration 4.

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

A **dedicated dashboard route/screen** (`/dashboard`, resolved in §11) shown after
verification and reachable any time while logged in.

| Section | Content | Source |
|---------|---------|--------|
| Welcome header | Greeting with first name + business name | Clerk + business profile |
| **Settings / Profile** | Link/tab to view & edit the business profile (see §6.1) | PostgreSQL + Clerk |
| **Saved templates** | List of templates; open / **rename / edit items** / delete (see §6.2) | PostgreSQL |
| **Quote history** | Searchable/filterable list of quotes with a detail view (see §6.3) | PostgreSQL |
| **Email history** | Record of quote emails sent to clients, with filters (see §6.3) | PostgreSQL |
| Quick actions | "New quote", "Open templates", "Settings", account/sign-out | — |

- Empty states: friendly prompts ("No quotes yet — create your first quote").
- Templates remain **global** in this iteration with a delete capability (per-user
  ownership deferred; see §10/§11).

### 6.1 Settings / Profile page
A dedicated page to **view and update the business profile** used on quotes/PDFs.

- **Editable fields:** business name, **mobile** (`+61-4` + 8 digits, see §4.2),
  **ABN** (11-digit format check), **ACN** (optional, 9-digit format check), address,
  marketing-consent flag.
- **Name & email:** first name / surname / email are managed by **Clerk** (link out to
  Clerk's account UI, or expose first/surname edits that write back to Clerk).
- Saving validates the same rules as registration; changes persist to PostgreSQL
  (Clerk fields write back to Clerk).

### 6.2 Template management (edit)
- **Rename** a template (subject to the global case-insensitive uniqueness rule).
- **Edit items** — update the saved line items/settings of an existing template.
- **Delete** a template (resolved in §11).
- Empty state when no templates exist.

### 6.3 Quote & Email history — detail view + filters
- **List → detail:** each quote/email opens a **detail view** (full line items,
  settings, totals, client info, and — for emails — the message sent and timestamp).
- **Filters (both histories):**
  - **Client name**
  - **Client email**
  - **Client suburb**
  - **Month the quote was sent** (sent-date month/year)
- Filters are combinable; empty states when no results match.

### 6.4 Email quotes to clients (on behalf of the user)
QuoteCraft can email a quote (with its PDF, Iteration 4) **to the client on the user's
behalf**. See §6.5 for the sending capability.

- **Editable client details per send:** **client name, client address, client email**
  (and client suburb, used by history filters).
- **Email template:** a user-editable **email template** (subject + body, with
  placeholders such as client name, business name, quote total) used as the default
  message; editable per send.
- **Email records:** every send is **saved to the dashboard** (Email history) with
  client name/email/suburb, subject, body snapshot, the quote reference, and sent
  timestamp.
- Sending is a **gated action** (verified users only) and **records the quote to
  history** (Save / Download / Email all persist — §11).

### 6.5 Email-sending capability (provider) — Resend (connected)
> **Provider decision — RESOLVED:** **Resend** is connected via the Replit Resend
> integration (credentials handled by the connector proxy; the app never stores raw
> API keys). Emails are sent **server-side from the api-server** using the Resend
> connector. The `@replit/connectors-sdk` package will be added to the **api-server**
> package when the feature is built (not the workspace root).
>
> **Sender model (still to confirm):** send from a **central QuoteCraft address on a
> verified domain** (e.g. `quotecraft.com.au`, best deliverability) vs. a Resend
> shared/sandbox sender for development. Domain verification (DKIM/SPF DNS records) is
> required for production deliverability.
>
> **Answer to "do we have native capability to send client emails?"** — Replit has
> **no built-in service for sending arbitrary outbound client emails**, and **Clerk
> only sends auth emails** (verification/welcome), not quotes to clients. To email
> quotes on behalf of users we use a **first-class email integration** (handles OAuth/
> API keys securely):
>
> - **Transactional providers — recommended:** **Resend** or **SendGrid** (also
>   Brevo, Mailchimp, Loops.so). Emails are sent from a QuoteCraft sender; for best
>   deliverability a verified domain (e.g. `quotecraft.com.au`) is configured.
> - **User's own mailbox:** **Gmail** or **Microsoft Outlook** connectors send from
>   the user's personal mailbox via OAuth (the client sees the user's own address).
>
> **Decision needed (see §11 open items):** which provider, and whether emails are
> sent from a central QuoteCraft sender or each user's own mailbox.

---

## 7. Data Storage & Architecture

| Data | Where it lives |
|------|----------------|
| First name, surname, email, email verification, password (hashed), sessions/tokens | **Clerk** |
| Business profile (business name, **mobile**, **ABN**, **ACN**, address) | **PostgreSQL** |
| Marketing-consent flag | **PostgreSQL** (or Clerk metadata) |
| Templates (global; with edit + delete) | **PostgreSQL** |
| **Quote history (net-new)** | **PostgreSQL** |
| **Email history (net-new)** — quote emails sent to clients | **PostgreSQL** |
| Mobile — **captured at registration** (`+61-4` + 8 digits, see §4.2); pre-populates the PDF header (Iteration 4) | **PostgreSQL** |

### 7.1 New persistence (proposed)
- **`business_profiles`** — one row per user: `userId` (Clerk id), `businessName`,
  `mobile` (normalised `+61 4 XXXX XXXX`), `abn`, `acn?`, `address`,
  `marketingConsent` (bool), timestamps. (First name / surname / email live in Clerk.
  **Logo scrapped** — not stored; see §11.)
- **`quotes`** (quote history) — `id`, `userId`, `label`, `clientName?`,
  `clientEmail?`, `clientAddress?`, `clientSuburb?`, `lineItems` (json),
  `settings` (json), computed `total`, `createdAt`, `sentAt?`. (Client fields +
  `sentAt` back the history filters in §6.3.)
- **`email_records`** (email history) — `id`, `userId`, `quoteId`, `clientName`,
  `clientEmail`, `clientSuburb?`, `subject`, `body` (snapshot), `status`, `sentAt`.
- **`email_templates`** — user-editable default email subject/body for client sends
  (one or more per user).
- **Templates** — remain **global** in this iteration (per-user ownership deferred);
  add **rename + edit-items** and **delete** capabilities. The interim global
  case-insensitive unique index stays.
- Save-on-create wiring records a quote to history when the user **saves, downloads,
  or emails** (resolved — see §11).
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
6. User chooses **Sign up** → enters **first name, surname** (≤50 chars each),
   email, password, **business name, mobile** (`+61-4` + 8 digits), **ABN,
   address**, optional **marketing consent** (unticked).
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
- [ ] Registration captures **first name, surname** (≤50 chars each), **business name,
      mobile** (`+61-4` + 8 digits), **ABN** (11-digit format check), **address** +
      optional marketing consent (unticked by default) and persists them appropriately.
- [ ] The **dashboard is a dedicated route/screen** showing saved templates, quote
      history, and email history with empty states.
- [ ] A **Settings/Profile page** lets the user view & update the business profile
      (business name, mobile, ABN, ACN, address, marketing consent); name/email via Clerk.
- [ ] Templates support **rename, edit items, and delete** (uniqueness stays global).
- [ ] Quote history and email history each have a **detail view** and **filters** on
      **client name, client email, client suburb, and quote-sent month**.
- [ ] A quote is recorded to history on **Save, Download, or Email** (not on generation).
- [ ] Users can **email a quote to a client** (on their behalf) with **editable client
      name/address/email**, an **editable email template**, and every send is **saved
      as an email record** on the dashboard.
- [ ] Cancelling the auth modal leaves the quote intact and performs no action.

---

## 10. Dependencies & Downstream

- **Bug #6** template-name uniqueness **remains global** here (per-user ownership is
  deferred); this iteration adds the ability to **delete** a template.
- **Enhancement #2 (Branded PDF, Iteration 4)** pre-populates from the business
  profile captured in this iteration.
- **Quote history** is net-new persistence introduced here.
- **Enhancement #6 (address lookup/validation)** is independent and **deferred** —
  address remains free-text in this iteration.

---

## 11. Resolved Decisions (signed off)

1. **Quote-history trigger — RESOLVED:** record a quote to history on **Save,
   Download, and Email** (any of the three gated actions persists the quote). A quote
   is **not** recorded on mere generation/edit.
2. **Dashboard placement — RESOLVED:** the dashboard is a **dedicated route and
   screen** (e.g. `/dashboard`), not an inline panel. After verify the user lands on
   it; the gated action still auto-resumes (see Flow A).
3. **ABN validation depth — RESOLVED:** **format-only — 11 digits**. No authoritative
   ABR lookup in this iteration (may be scheduled later).
4. **Branded sender — RESOLVED:** use the **default Clerk sender for now**. A custom
   email domain (`quotecraft.com.au`) is deferred.
5. **Templates — RESOLVED:** **keep templates global for now** (no per-user migration
   in this iteration), **but add rename, edit-items, and delete**. Per-user template
   ownership is deferred to a later iteration.
6. **ACN — RESOLVED:** **save ACN anyway** as an optional business-profile field
   (9-digit format check), editable on the Settings/Profile page; flows through to the
   PDF header (Iteration 4).
7. **Settings/Profile, template editing, and quote/email history detail + filters** are
   **in scope** for this iteration (filters: client name / email / suburb / sent month).

### 11.1 Email sending — provider RESOLVED, one item open
- **Provider — RESOLVED:** **Resend**, connected via the Replit integration (no raw
  API keys in the app; sent server-side from the api-server).
- **Still to confirm — sender domain:** use a **verified custom domain**
  (`quotecraft.com.au`) for production deliverability, or a Resend **shared/sandbox
  sender** for development only. Domain verification needs DKIM/SPF DNS records.
- The email-quotes feature (§6.4–§6.5) can be built against Resend now; the rest of
  Iteration 3 is independent of the domain question.
