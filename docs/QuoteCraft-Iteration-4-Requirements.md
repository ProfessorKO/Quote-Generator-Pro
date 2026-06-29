# QuoteCraft — Iteration 4 Requirements: Branded PDF Export

> **Status:** Draft for sign-off · **Depends on:** Iteration 3 (auth, business
> profile, quote history) · **Source enhancement:** Enhancement #2 (Branded PDF
> export) in the master spec.
>
> This is a standalone, editable working spec for Iteration 4. The master
> consolidated requirements doc (`docs/QuoteCraft-Requirements-v4.0.md`) remains the
> source of truth and is **not** modified here.

---

## 1. Goal

Let a verified user export a **branded, client-ready PDF** of a quote. The header is
**pre-populated from the business profile** captured at registration (Iteration 3) so
exports are branded without re-typing, while still allowing per-export overrides.

---

## 2. Why this iteration is last

The PDF header fields (business name, mobile, ABN, address, email) come from the
**business profile** persisted in Iteration 3. Building PDF export after auth means
the export form is pre-filled rather than manually typed every time.

---

## 3. Dependency on Iteration 3

| Iteration 3 output | How Iteration 4 uses it |
|--------------------|--------------------------|
| **Business profile** (`business_profiles`): business name, **mobile**, **ABN**, **ACN**, address | Pre-populates the PDF header form. |
| **First name / surname / email** (Clerk) | Default **contact name** + contact email on the PDF. |
| **Auth gating** (verified users only) | Export is a gated action — only verified users can download a PDF. |
| **Quote history** (`quotes`) | A downloaded quote is recorded to history (Save / Download / Email all persist — see Iteration 3 §11). |

> **Change vs. master spec:** the master doc (pre–Iteration 3 decision) treated the
> PDF **mobile** as *optional and entered per export*. Following the Iteration 3
> sign-off, **mobile is now captured at registration** and therefore **pre-populates**
> the PDF header. The export form still allows editing/override for a one-off quote.

---

## 4. Export Form (shown when the user requests a PDF)

| Field | Required | Source / default | Notes |
|-------|----------|------------------|-------|
| **Contact name** | **Yes** | Defaults to `First name + Surname` (Clerk) | Editable per export. |
| **Business name** | Yes | Business profile | Editable; shown in header. |
| **Mobile** | Optional on the PDF | Business profile (`+61 4 XXXX XXXX`) | Fixed read-only **`+61-4`** prefix + **8 digits** (see §5). If blank, omitted from the PDF. |
| **Email** | Yes | Clerk email | Shown in header. |
| **Address** | Yes | Business profile | Editable; shown in header. |
| **ABN** | Optional override | Business profile | **11-digit** format check (same rule as registration). If present, shown in header. |
| **ACN** | Optional override | Business profile (`acn`) | **9-digit** format check. If present, shown in header. |

> **No logo.** The logo upload/branding image has been **scrapped** (resolved §9) — the
> PDF header is text-only.

All defaults are **editable** at export time. If the user edits any header field so it
**differs from the saved business profile**, on export **prompt them to save the changes
back to the profile** (override) — see §9. Declining keeps the edit as a one-off for
that PDF only.

---

## 5. Mobile field — format & rules (consistent with Iteration 3 §4.2)

- Fixed, **read-only `+61-4`** prefix shown on the leading edge of the field; the user
  enters **exactly 8 digits** (the part after the leading `4`).
- Strip spaces/non-digits on input; if entered, **all 8 digits must be present** before
  export.
- Displayed/exported as **`+61 4 XXXX XXXX`**.
- **If blank, the mobile is omitted from the PDF** (no empty label).

---

## 6. PDF Contents

The generated PDF must include:

1. **Header block** (text-only — no logo)
   - **Business name**, **contact name**, **address**, **email**, optional **mobile**,
     optional **ABN**, optional **ACN**.
2. **Quote body**
   - All **line items** (label/description, quantity, unit price, line total).
   - **Client / quote label** if present.
3. **Totals & tax breakdown (Australian rules)**
   - **Subtotal** (pre-GST).
   - **Call-out fee** (flat, added pre-GST) if present.
   - **Public-holiday surcharge** if present.
   - **GST = 10%** shown as an explicit line.
   - **Grand total** (GST-inclusive).
4. **Footer message**
   - *"Thank you for your business! We are looking forward to hearing from you!"*

---

## 7. Acceptance Criteria

- [ ] Only **verified** users can download a PDF (gated, per Iteration 3).
- [ ] PDF header **pre-populates** from the business profile (business name, mobile,
      ABN, ACN, address) and Clerk (contact name, email); all are editable per export.
- [ ] The PDF header is **text-only — no logo**.
- [ ] **Mobile** uses the fixed `+61-4` prefix + 8 digits; renders as `+61 4 XXXX XXXX`;
      **omitted entirely when blank**.
- [ ] **ABN** (11 digits) and **ACN** (9 digits) are format-checked; shown only when
      present.
- [ ] PDF renders **all line items**, the **GST (10%) breakdown**, call-out fee and
      surcharge when present, and the **grand total**.
- [ ] PDF includes the exact **footer message**.
- [ ] PDF is generated **client-side** (in-browser).
- [ ] If header edits **differ from the saved profile**, the user is **prompted to save
      the override** back to the business profile; declining keeps the edit one-off.
- [ ] Downloading a quote **records it to history** (consistent with Iteration 3 §11).

---

## 8. Out of Scope (this iteration)

- Custom email domain / branded sender (deferred — default Clerk sender per Iteration 3).
- Address lookup/validation (Enhancement #6 — deferred; address stays free-text).
- Payment processing / invoicing beyond quote PDF generation.
- **Logo / branding image** — scrapped (§9).

---

## 9. Resolved Decisions (signed off)

1. **Logo — RESOLVED:** **scrapped**. No logo upload or storage; the PDF header is
   text-only.
2. **ACN — RESOLVED:** **save it anyway** as an optional business-profile field
   (9-digit format check, captured/editable in Iteration 3 Settings/Profile); it
   pre-populates the PDF and is shown when present.
3. **PDF generation approach — RESOLVED:** **client-side** (in-browser rendering).
4. **Saved overrides — RESOLVED:** if export-time header edits differ from the saved
   business profile, **prompt the user to save the changes** back to the profile
   (override); if they decline, the edit applies to that PDF only.
