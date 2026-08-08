---
name: Stripe mirror lag in billing reads
description: stripe.* schema syncs asynchronously AND is write-protected for the app role; billing reads must not trust a missing/stale mirror row
---
The `stripe.*` schema (stripe-replit-sync) lags behind Stripe API writes, and the app role CANNOT patch it — `UPDATE stripe.subscriptions SET cancel_at_period_end = ...` fails with "column can only be updated to DEFAULT". Any "best-effort mirror write" silently no-ops.

**Why:** After `stripe.subscriptions.update(...)` or a fresh checkout, the local `stripe.subscriptions` row can be stale or absent for a while. Naively deriving plan from the mirror caused (a) stale cancel/undo UI after query invalidation (#44), and (b) risk of downgrading a just-confirmed Pro user to free.

**How to apply:**
- Never write to stripe.* tables from app code — it fails silently under try/catch. Instead, subscription-state routes write the denormalised `user_profiles.plan/subscription_status` synchronously AND stamp `subscription_state_updated_at`.
- `subscription_state_updated_at` must be written ONLY by subscription-state changes (setProfileSubscriptionState, checkout confirm) — never by unrelated profile writes like `upsertCurrentUser`, or freshness comparison breaks (a plain `updated_at` moves on every status fetch).
- When the mirror row is active but disagrees with the profile on the cancel flag, trust whichever is fresher: compare `subscription_state_updated_at` vs mirror `_updated_at`. Dashboard-side changes still win once the sync lands a newer mirror row.
- When the mirror row is missing but the profile says paid, trust the profile — never downgrade on an absent row. Only reconcile down when the mirror has an authoritative non-active row.

## Reconnect quirks (learned during go-live)
- The stripe.* mirror is append-only for us: rows from a previously connected (now disconnected) Stripe account cannot be deleted (`Mutating stripe.* tables is not allowed`). Catalog lookups must dedupe by newest price per metadata key (`DISTINCT ON ... ORDER BY key, pr.created DESC`) or checkout can pick a dead price.
- `stripe-replit-sync`'s `syncBackfill()` with no params can no-op (returns instantly, syncs nothing). Force a real backfill with `syncProducts({created:{gte:1}})` / `syncPrices(...)`.
- To find out which Stripe account a deployment is really using: check which account received its managed webhook (`stripe.webhookEndpoints.list()` → look for the deployment URL + livemode). Checkout session id prefix (`cs_test_`/`cs_live_`) is the other decisive tell.
- Removing the Stripe integration and reconnecting creates a BRAND NEW empty sandbox — the catalog must be re-seeded.
- After the live account got linked (reinstall via Stripe dashboard uninstall → Replit reconnect), prod deployments receive LIVE keys while the workspace keeps sandbox keys — same connection, mode differs by environment. All stripe.* mirror reads must be scoped by `_account_id` of the current credentials (resolve via GET /v1/account, cacheable per secret key); livemode alone is not enough since multiple live/test accounts can coexist in the mirror.
- Stored stripeCustomerId/stripeSubscriptionId in user profiles go stale on an account/mode switch: verify customer with customers.retrieve (recreate on resource_missing), and treat a mirror subscription row from a different `_account_id` as dead (clear it, downgrade to free).
- Once a live account is linked, the Replit Stripe connection returns TWO settings blocks (sk_test_ and sk_live_) under the same connector name. Deployments do NOT automatically get the live one — the app must pick by key prefix (live when REPLIT_DEPLOYMENT=1/WEB_REPL_RENEWAL, test in workspace). Taking the first item silently keeps prod on sandbox.
- Checkout latency: cache connector credentials briefly (60s) — every uncached Stripe call pays a connector round trip; also skip Clerk upserts when the profile row already exists and parallelize catalog/customer lookups.
