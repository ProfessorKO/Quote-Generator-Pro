---
name: Stripe mirror lag in billing reads
description: stripe.* schema syncs asynchronously; billing reads must not trust a missing/stale mirror row
---
The `stripe.*` schema (stripe-replit-sync) lags behind Stripe API writes.

**Why:** After `stripe.subscriptions.update(...)` or a fresh checkout, the local `stripe.subscriptions` row can be stale or absent for a while. Naively deriving plan from the mirror caused (a) stale cancel/undo UI after query invalidation, and (b) risk of downgrading a just-confirmed Pro user to free.

**How to apply:**
- After mutating a subscription via the Stripe API, also write the changed flag into the local mirror row (best-effort UPDATE, try/catch) so an immediate refetch is consistent; the next sync reasserts the same value.
- When deriving plan and the mirror row is missing but the profile says paid, trust the denormalised `user_profiles.plan/subscription_status` — never downgrade on an absent row. Only reconcile down when the mirror has an authoritative non-active row.
