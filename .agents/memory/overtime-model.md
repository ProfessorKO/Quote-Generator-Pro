---
name: Overtime data model
description: How overtime is represented on a quote line item and why
---

# Overtime = percentage markup on the base unitPrice

A quote line item carries an optional `overtimePercent`. The charged rate per
unit is **derived**, never stored:

```
effectiveRate = unitPrice + (unitPrice * overtimePercent / 100)
```

- `unitPrice` ALWAYS stays the BASE rate. Overtime is never baked into it.
- `overtimePercent` is a percentage, never a dollar amount. Clamped `>= 0` on
  both client (`handleUpdateItem`) and server (`apply-voice-command` /
  `parse-quote` normalisation).
- Voice: "overtime 10%" / "change overtime to 15%" sets the percent; "remove
  overtime" sets 0. The AI prompt in `apply-voice-command.ts` explicitly forbids
  baking it into `unitPrice` or using a raw dollar value.

**Why:** before this, the AI had no overtime concept and turned "overtime 10%"
into a flat $8 unitPrice. Keeping overtime as a separate percentage preserves the
base rate and makes totals/PDF reproducible.

**How to apply:** anywhere a line total is computed (totals, per-line display,
future PDF export) use `effectiveRate`, not raw `unitPrice * quantity`.
