---
name: Clerk testing and backend API quirks
description: Gotchas when e2e-testing Clerk-authed pages and calling the Clerk REST API directly
---
- `runTest({ testClerkAuth: true })` occasionally reports "programmatic Clerk sign-in helper not available" or fails to establish a second sign-in context. **How to apply:** retry the identical run once (it usually passes), and prefer one sign-in context per test run instead of two contexts in a single plan.
- Clerk REST API `order_by=+created_at`: the `+` must be URL-encoded (`%2B`) in raw fetch calls or Clerk returns a 422 (the `+` decodes to a space). The @clerk/express SDK handles this itself.
- Marketing consent is stored per USER in `user_profiles` (owner decision, July 2026), while the `/profile` API contract still exposes `marketingConsent` on the BusinessProfile payload so the frontend stays unchanged. **Why:** consent belongs to the person, and business_profiles became 1:many per user. Don't move it back or duplicate it onto business rows.
