---
name: Anonymous rate limiting & proxy trust
description: How anonymous AI endpoints are throttled and why trust proxy must be 1, not true
---
Rule: the API sets Express `trust proxy` to `1` (exactly one trusted hop — Replit's proxy). Never set it to `true`.
**Why:** `trust proxy: true` trusts every X-Forwarded-For hop, so clients can prepend a fake IP and mint a fresh rate-limit bucket per request — a code review rejected exactly that. With `1`, req.ip comes from the rightmost XFF entry appended by the trusted proxy and is not spoofable.
**How to apply:** any IP-keyed control (rate limits, abuse counters) must derive identity from `req.ip` under this setting. Anonymous callers of the AI endpoints share one in-memory fixed-window limiter (30/hr/IP, 429 + Retry-After); authenticated users are exempt because billing meters them. Test pattern: forged-XFF integration test in the api-server test dir.
