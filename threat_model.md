# Threat Model

## Project Overview

QuoteCraft is a Node.js/Express (v5) API backend serving a React frontend for Australian tradespeople. Users describe their business pricing; the app uses OpenAI to generate structured quote line items, which can be saved, emailed to clients (via Resend), and managed over time. Billing is handled via Stripe subscriptions and a coupon-based free-trial system. Authentication uses Clerk (session cookies + JWT). The database is PostgreSQL accessed via Drizzle ORM. The app is not yet deployed (no active Replit deployment found in scan).

## Assets

- **User sessions and credentials** — Clerk session cookies and JWT tokens. Compromise allows impersonation, billing manipulation, and data exfiltration.
- **Quote and client data** — Business-sensitive pricing data, client names, emails, and addresses. Scoped per-user in the database.
- **Business profile data** — ABN, ACN, address, mobile number. PII tied to the authenticated user.
- **Email history** — Records of quotes sent to clients, including client contact details.
- **Billing state** — Stripe subscription IDs, customer IDs, coupon redemptions, trial end dates. Manipulation could grant unauthorized Pro access or trigger unauthorized payments.
- **Application secrets** — `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`. Exposure of any would be critical.
- **OpenAI API budget** — Operator-paid per-token cost. Abuse without auth can generate unbounded charges.

## Trust Boundaries

- **Browser to API** — All client requests cross this boundary over HTTPS. CORS policy currently reflects any origin with credentials, which effectively removes this boundary for users visiting attacker-controlled pages.
- **API to PostgreSQL** — Drizzle ORM with parameterized queries. No raw SQL string concatenation observed.
- **API to Stripe** — Stripe checkout and webhook paths. Webhook signature is verified. Checkout `success_url`/`cancel_url` are currently constructed from the attacker-controlled `Origin` header.
- **API to OpenAI** — Operator-paid API calls triggered by both authenticated and anonymous users. No rate limiting for anonymous callers.
- **API to Clerk** — Token validation performed server-side by Clerk middleware. Admin role is enforced by checking the user's primary email against an `ADMIN_EMAILS` environment variable.
- **Public / Authenticated** — Most routes require `requireAuth`. `/parse-quote` and `/apply-voice-command` use `optionalAuth` (anonymous access intentional but unthrottled). `/health` is fully public.

## Scan Anchors

- **Entry points**: `artifacts/api-server/src/app.ts` (middleware stack), `artifacts/api-server/src/routes/index.ts` (route registration)
- **Highest-risk code**: `artifacts/api-server/src/routes/billing.ts` (Stripe checkout, appOrigin open redirect), `artifacts/api-server/src/app.ts` (wildcard CORS), `artifacts/api-server/src/routes/parse-quote.ts` and `apply-voice-command.ts` (unauthenticated AI calls)
- **Admin surface**: `artifacts/api-server/src/routes/admin.ts` — protected by `requireAuth` + `requireAdmin` (email allowlist from `ADMIN_EMAILS` env var)
- **Webhook**: `POST /api/stripe/webhook` — raw body, signature verified via Stripe SDK
- **Dev-only**: `artifacts/mockup-sandbox/` — Vite mockup sandbox, not production-reachable

## Threat Categories

### Spoofing

Clerk handles authentication; session tokens are validated server-side on every request. The admin gate cross-checks against Clerk's canonical user record (not a client-supplied value), preventing email spoofing in admin checks. No issues found in authentication logic itself.

### Tampering

Database writes scope every mutation to the authenticated `userId` (verified by pattern across quotes, templates, email records, profile). Stripe prices and billing decisions are computed server-side. Coupon redemption is transactional with a unique constraint preventing double-redemption. No client-supplied price or role fields observed.

### Information Disclosure

All data-returning endpoints filter by `userId` server-side before returning results; no cross-user data leakage observed in read paths. However, the wildcard-CORS policy enables any attacker page to read an authenticated user's quotes, profile, and email records via cross-origin fetch.

### Denial of Service / Cost Abuse

`/parse-quote` and `/apply-voice-command` accept anonymous requests that trigger OpenAI API calls without any IP-based rate limiting. An attacker can exhaust the operator's OpenAI budget at no cost to themselves.

### Elevation of Privilege

Admin endpoints require both `requireAuth` and `requireAdmin` (email allowlist). No privilege-escalation paths found in authorization logic. Stripe webhook cannot be forged (signature verified before processing).

### Spoofing / Open Redirect (Payment Flow)

The `appOrigin()` helper in `billing.ts` reflects the request's `Origin` header into Stripe `success_url`/`cancel_url`. Combined with the wildcard CORS policy, an attacker can create a checkout session whose post-payment redirect points to an attacker-controlled domain, leaking the Stripe session ID and redirecting the victim.
