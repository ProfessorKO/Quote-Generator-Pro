---
name: QuoteCraft billing conventions
description: Durable rules for the Stripe monetization layer (metering, 402 contract, checkout confirm)
---

- Metered actions return HTTP 402 `{code:'LIMIT_REACHED', action}`; the frontend detects this via the generated client's `ApiError` (`.status` + `.data`) in `src/lib/billing.ts::limitReachedAction` and shows the shared `LimitDialog` (CP1–5).
- **Why:** one uniform contract lets every new metered endpoint get paywall UI for free.
- Consumption rules the code must stay consistent with: voice edits consume only when `understood === true`; emails consume-then-refund on send failure; PDF downloads consume client-side via POST /usage/pdf-download BEFORE building the PDF locally; template PUT/DELETE and manual edits are never metered; credits are spent before free monthly limits (Sydney calendar month).
- Template slot check and insert must run in ONE transaction (advisory lock `billing:<userId>`) — `authorizeTemplateSave(userId, run)` takes the insert as a callback. Splitting them reopens a concurrent free-slot bypass.
- Checkout confirm: never strip `session_id` from the URL until POST /billing/confirm succeeds; on failure keep it and show a "Finish confirming purchase" retry (confirm is idempotent via credit_purchases PK).
- Stripe catalog products carry metadata `quotecraft_key` (pro_plan, credits_N); reseed with `scripts/src/seed-stripe-products.ts` (rerunnable).
- Coupon feature (agreed lean v1 scope, July 2026): free_trial type only, no admin portal — but MUST include a protected `POST /api/admin/coupons` endpoint (isAdmin flag on user_profiles, owner's account flagged) because agent SQL access to the production DB is read-only; direct inserts only work in dev.
