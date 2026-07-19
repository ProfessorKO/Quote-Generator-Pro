---
name: React Query cache reset on Clerk user change
description: Why qc.clear() on auth change causes infinite spinners; use cancelQueries + resetQueries instead
---

Rule: when wiping the TanStack Query cache because the signed-in user changed (Clerk listener), never call `queryClient.clear()` — call `cancelQueries()` then `resetQueries()`.

**Why:** `clear()` removes in-flight queries without notifying active observers, so any component mid-fetch (e.g. a post-auth gate right after sign-in) is left in `isLoading` forever — an infinite spinner until manual refresh. `resetQueries()` refetches active observers.

**How to apply:** any auth-change cache invalidation listener; also gate post-auth queries on Clerk `isLoaded && isSignedIn` (`enabled`) and ensure every render branch has an exit (redirect) rather than falling through to a permanent loading fallback.
