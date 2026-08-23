---
name: Anonymous rate limiting & proxy trust
description: How anonymous AI endpoints are throttled and why trust proxy must be 1, not true
---
Rule: the API sets Express `trust proxy` to `1` (exactly one trusted hop — Replit's proxy). Never set it to `true`.
**Why:** `trust proxy: true` trusts every X-Forwarded-For hop, so clients can prepend a fake IP and mint a fresh rate-limit bucket per request — a code review rejected exactly that. With `1`, req.ip comes from the rightmost XFF entry appended by the trusted proxy and is not spoofable.
**How to apply:** any IP-keyed control (rate limits, abuse counters) must derive identity from `req.ip` under this setting. Anonymous callers of the AI endpoints share one in-memory fixed-window limiter (30/hr/IP, 429 + Retry-After); authenticated users are exempt because billing meters them. Test pattern: forged-XFF integration test in the api-server test dir.

## Anonymous daily AI limit (added Aug 2026)
Signed-out visitors get 3 AI actions per Sydney day (quote generations + understood voice edits, shared budget), persisted in the anon_daily_usage table — NOT in memory, so it survives republishes.
**Why:** in-memory counters reset on every deploy; and a naive check-then-consume was race-prone — concurrent requests all passed a stale read. Slots are RESERVED atomically before the AI call (single INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit) and RELEASED on failure paths (AI error, unparseable JSON, voice command not understood). Any served 200 (including the schema-fallback quote) stays billed.
**How to apply:** key is v:<visitorId> (client UUID in localStorage, spoofable by design) with ip:<ip> fallback; the 30/hr in-memory IP limiter remains the anti-abuse backstop. Limit response is 429 {code:"ANON_DAILY_LIMIT_REACHED"} — distinct from the limiter's 429 RATE_LIMITED and from the signed-in 402 contract; the frontend switches on the code field.

## Funnel events endpoint
POST /api/events writes funnel_events rows (enum enforced in OpenAPI + zod + DB CHECK). It has NO billing meter behind it, so its rate limiter uses exemptAuthenticated:false (per-user bucket for signed-in callers, per-IP for visitors). Any future unmetered write endpoint should do the same — the default limiter exempts signed-in users.
