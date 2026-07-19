---
name: Orval query options need queryKey
description: Generated react-query useGet* hooks in @workspace/api-client-react require an explicit queryKey whenever you pass a query option object.
---

When calling a generated query hook (e.g. `useGetBusinessProfile`, `useGetEmailTemplate`) and you pass anything in the `query` option object (like `retry: false` or `enabled`), TypeScript fails with `Property 'queryKey' is missing` — even though the hook supplies a default key at runtime.

**Rule:** include the matching key helper, e.g.
`useGetBusinessProfile({ query: { retry: false, queryKey: getGetBusinessProfileQueryKey() } })`.
Each query hook has a corresponding `getGet<Name>QueryKey()` exported from `@workspace/api-client-react`.

**Why:** orval-generated `UseQueryOptions` types mark `queryKey` as required on the options object even though the runtime falls back to the default key. Passing it explicitly satisfies tsc and reuses the canonical key (so cache invalidation by that key still works).

**How to apply:** any time you add `retry`, `enabled`, `staleTime`, etc. to a generated query hook, also pass `queryKey: getGet<Name>QueryKey()` and import that helper.
