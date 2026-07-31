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
- Coupon feature (lean v1, July 2026): free_trial type only, no admin portal. Codes are created via protected `POST /api/admin/coupons` (gated by the existing ADMIN_EMAILS requireAdmin — no isAdmin column) because prod SQL is read-only; direct inserts only work in dev.
- Coupon trials live ONLY in `user_profiles.trial_ends_at` — they never write `plan`/`subscription_status` (those stay Stripe-only so mirror-freshness logic is untouched). Derivation: paid sub wins over trial; expired trial = free with no cron/write. Already-Pro users (paid or trial) cannot redeem; redemption uniqueness = unique(coupon_id,user_id) + FOR UPDATE on the coupon row for max-uses.
