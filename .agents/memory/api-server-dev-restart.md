---
name: API server dev workflow rebuilds
description: Why edits to artifacts/api-server need a workflow restart to take effect
---

The `artifacts/api-server` dev workflow runs `pnpm run build && pnpm run start`
(esbuild bundle → `node dist/index.mjs`). It is NOT a watch/hot-reload server.

**Why:** Editing a route file (e.g. `src/routes/templates.ts`) does not change the
already-running bundle. A live request will keep hitting the old code, which can
look like your fix "didn't work" (e.g. a duplicate POST returning 201 instead of
the new 409).

**How to apply:** After any change under `artifacts/api-server/src`, restart the
`artifacts/api-server: API Server` workflow before testing the endpoint. The web
artifacts (vite) DO hot-reload, so only the API needs the manual restart.
