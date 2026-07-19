---
name: API client error shape
description: How to read server error payloads from the generated api-client-react ApiError
---

Rule: the generated `@workspace/api-client-react` custom fetch throws an `ApiError` whose parsed JSON body is on `err.data` (typed `T | null`). It is NOT an Axios error — there is no `err.response.data`. `err.response` is the native `Response` object; `err.status`/`err.statusText` are also on the error.

To surface a server error message in a react-query `onError`, read `(err as { data?: { error?: string } })?.data?.error` and fall back to a generic message.

**Why:** a first attempt used the Axios shape `err.response.data.error`, which silently dropped every server-mapped message and always showed the generic fallback. Caught in code review.

**How to apply:** any react-query mutation/query `onError` that needs the server's `{ error }` payload must read `err.data`, not `err.response.data`. `ApiError` is not exported from the package index, so narrow structurally on `.data`.
