---
name: Form drafts & validation conventions
description: QuoteCraft conventions for draft autosave freshness and blur-time validation (autofill-safe)
---

## Draft autosave freshness
Rule: any localStorage form draft that mirrors a server record must be saved in a `{v:1, savedAt, data}` envelope and restored only if `savedAt >= Date.parse(record.updatedAt)` (see `useFormDraft`'s `ignoreBefore`).
**Why:** architect review caught stale profile drafts silently overriding fresh server data in Settings, causing users to re-save outdated info.
**How to apply:** when wiring `useFormDraft` to any form seeded from a server entity, always pass `ignoreBefore: Date.parse(entity.updatedAt)`.

## Blur-time validation (autofill-safe)
Rule: validate fields on blur using `e.target.value` (not React state), sync state in the same handler, and clear the field's error on change; submit re-validates everything.
**Why:** mobile browser autofill fills the DOM without firing React change events — a user's phone-cached address kept failing validation until a manual keystroke re-synced state.
**How to apply:** every new form field follows the onChange(clear error) + onBlur(sync + validate from event value) pattern used across the quote dialogs and profile form.
