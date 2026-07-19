---
name: Resend connector settings server-side
description: How to read from_email (and other secret settings) for the Resend connector from server code
---
The rule: `@replit/connectors-sdk` `listConnections()` does NOT return credential settings (e.g. `from_email`, `api_key`) when called from server code — those are secrets. Only the sandbox helper `listConnections()` enriches them.

**Why:** Bug #24 regressed because getFromEmail() read `connections[0].settings.from_email` via the SDK; it was always undefined server-side, producing a false "email isn't set up" 503 even with a fully configured connection.

**How to apply:** Server-side, fetch `https://${REPLIT_CONNECTORS_HOSTNAME}/api/v2/connection?include_secrets=true&connector_names=<name>` with header `X_REPLIT_TOKEN` = `"repl " + REPL_IDENTITY` (dev) or `"depl " + WEB_REPL_RENEWAL` (deployment); settings are in `items[0].settings`. Keep the actual API call going through `connectors.proxy(...)` — only the settings lookup needs the credential proxy. Also: Resend 403 "domain is not verified" / "testing emails" responses are sender-config errors, not recipient errors — classify before any keyword match on "email".
