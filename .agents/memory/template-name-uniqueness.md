---
name: Template name uniqueness
description: How QuoteCraft enforces globally-unique, case-insensitive template names
---

Template names must be globally unique, case-insensitive, and whitespace-trimmed.

Enforced in two layers that must stay in lockstep:
1. **App level** (`artifacts/api-server/src/routes/templates.ts`): POST and PUT
   trim the name, run a `lower(name) = lower(input)` pre-check (PUT excludes its
   own id via `ne`), and return HTTP 409 `{error: "A template with this name
   already exists"}` on conflict. They also catch Postgres `23505` as a race
   safety net and map it to the same 409.
2. **DB level** (`lib/db/src/schema/templates.ts`): `uniqueIndex` on
   `lower(name)` — the authoritative guard against concurrent inserts both
   passing the pre-check.

Client (`src/pages/home.tsx`) maps a 409 (`err.status === 409`, from `ApiError`)
to a friendly "name taken" toast.

**Why:** A pre-check alone races under concurrency; a DB constraint alone gives an
ugly 500. Both together = friendly message + guaranteed uniqueness.

**How to apply:** If you change name validation, update all three spots together,
and remember `drizzle-kit push` (`pnpm --filter @workspace/db push`) is needed for
the index, plus an api-server restart for the route code.
