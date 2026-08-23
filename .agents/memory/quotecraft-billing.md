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
- Coupon trials must never write the Stripe-owned plan/subscription columns — trial state stays a separate timestamp so the mirror-freshness logic is untouched. Paid subscription always supersedes a trial; expiry is pure derivation (no cron); already-Pro users (paid or trial) cannot redeem.

## Timezone conventions (Aug 2026)
All DB timestamp columns are timestamptz; the dev database default timezone is Australia/Sydney (display-only convenience for SQL views). All frontend date display goes through the shared formatDateAU/formatDateShortAU/formatDateTimeAU helpers (Intl en-AU) which render in the VIEWER'S DEVICE timezone — the owner explicitly reverted a pinned-Sydney display (Aug 2026) and wants device-local times. Exception: the admin screen pins AEST via formatDateTimeAEST. Never reintroduce a fixed timeZone in the shared helpers without asking.
**Why:** owner request; en-AU locale keeps day-month order while the zone follows the device. SQL that used to_char/extract on timestamps relied on the session timezone, which differs per environment. Month/year filters in quote + email routes now say AT TIME ZONE 'Australia/Sydney' explicitly.
**How to apply — PROD MIGRATION HAZARD:** production still has naive timestamp columns. When syncing prod schema, the column type conversions MUST run with session timezone UTC (naive values are UTC wall times); converting under a Sydney session shifts every stored instant by 10-11h. Convert first, only then optionally ALTER DATABASE ... SET timezone TO 'Australia/Sydney'.
