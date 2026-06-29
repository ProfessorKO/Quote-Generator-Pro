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
| **Business profile** (`business_profiles`): business name, **mobile**, ABN, address, optional logo | Pre-populates the PDF header form. |
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
| **Logo** | Optional | Business profile (`logoUrl`) if set; else upload | Rendered **top-left** of the PDF. PNG/JPG; reasonable size cap. |
| **Contact name** | **Yes** | Defaults to `First name + Surname` (Clerk) | Editable per export. |
| **Business name** | Yes | Business profile | Editable; shown in header. |
| **Mobile** | Optional on the PDF | Business profile (`+61 4 XXXX XXXX`) | Fixed read-only **`+61-4`** prefix + **8 digits** (see §5). If blank, omitted from the PDF. |
| **Email** | Yes | Clerk email | Shown in header. |
| **Address** | Yes | Business profile | Editable; shown in header. |
| **ABN** | Optional override | Business profile | **11-digit** format check (same rule as registration). If present, shown in header. |
| **ACN** | Optional | — (not captured at registration) | If present, shown in header. **9 digits** format check. |

All defaults are **editable** at export time; edits here do **not** silently change the
saved business profile unless the user explicitly saves them (out of scope unless
requested).

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

1. **Header / branding block**
   - Optional **logo** (top-left).
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
      ABN, address) and Clerk (contact name, email); all are editable per export.
- [ ] **Logo** is optional; when provided it renders top-left; when absent the layout
      stays clean (no broken image / empty box).
- [ ] **Mobile** uses the fixed `+61-4` prefix + 8 digits; renders as `+61 4 XXXX XXXX`;
      **omitted entirely when blank**.
- [ ] **ABN** (11 digits) and **ACN** (9 digits) are format-checked; shown only when
      present.
- [ ] PDF renders **all line items**, the **GST (10%) breakdown**, call-out fee and
      surcharge when present, and the **grand total**.
- [ ] PDF includes the exact **footer message**.
- [ ] Downloading a quote **records it to history** (consistent with Iteration 3 §11).

---

## 8. Out of Scope (this iteration)

- Custom email domain / branded sender (deferred — default Clerk sender per Iteration 3).
- Address lookup/validation (Enhancement #6 — deferred; address stays free-text).
- Payment processing / invoicing beyond quote PDF generation.
- Editing/saving business-profile changes from the export form (PDF-only overrides).

---

## 9. Open Questions for Sign-off

1. **Logo storage:** store the uploaded logo on the business profile (object storage +
   `logoUrl`) so it persists across exports, or accept a per-export upload only?
2. **ACN capture:** keep ACN as export-only (not in registration), or add it to the
   business profile later?
3. **PDF generation approach:** client-side (e.g. in-browser renderer) or server-side
   rendering? (Affects logo handling and fidelity.)
4. **Saved overrides:** if a user edits header fields at export time, should we offer to
   update the saved business profile, or always keep export edits one-off?
