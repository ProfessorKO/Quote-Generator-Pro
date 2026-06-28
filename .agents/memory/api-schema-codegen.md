---
name: API schema is codegen'd from openapi.yaml
description: Source of truth for shared types/zod and how to regenerate
---

# Shared API types are generated — edit the spec, not the generated files

`lib/api-spec/openapi.yaml` is the single source of truth for shared request/
response shapes (e.g. `QuoteLineItem`, `QuoteSettings`).

- The generated outputs are `lib/api-zod/src/generated/**` (zod schemas) and
  `lib/api-client-react/src/generated/api.schemas.ts` (react-query client).
  **Do not hand-edit** those — they are overwritten.
- Regenerate with: `pnpm --filter @workspace/api-spec run codegen` (runs orval
  then `typecheck:libs`).
- Make new fields **optional** in the spec (omit from `required:`) so existing
  persisted data (templates store lineItems as JSON) stays valid — no migration
  needed.
- After editing API routes, restart the api-server workflow (it serves a built
  bundle, not hot-reload — see api-server-dev-restart.md).

**Why:** editing a generated file looks like it works until the next codegen run
silently reverts it.
