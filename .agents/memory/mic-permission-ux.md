---
name: Microphone permission denial UX
description: How QuoteCraft handles mic permission denial and why it re-checks every tap
---

# Mic permission denial = device-specific written instructions, never cached

When mic access is denied there is **no programmatic way to re-open the browser's
permission prompt**. So the app shows the user written, device-specific steps
(`src/lib/mic-permission.ts` + `src/components/mic-permission-dialog.tsx`) and a
Retry button — no deep links (mobile OSes don't reliably support them).

- Permission is **re-checked on EVERY mic tap** via
  `navigator.mediaDevices.getUserMedia({audio:true})` (then stop the tracks).
  Never cache a denied result — the user may grant it in Settings between taps,
  and the Permissions API / SpeechRecognition won't reliably tell us.
- Device detection is UA-based and must be **browser-specific**, not just OS:
  iOS Chrome = `CriOS`; Android Chrome must match `Chrome/` AND exclude
  `Firefox|SamsungBrowser|EdgA|OPR|...` (those have different permission UIs) →
  otherwise they get wrong instructions. Unknown Android falls back to a generic
  Android guide.
- The getUserMedia pre-check is the primary denial path; `recognition.onerror`
  'not-allowed' is a secondary path (permission revoked mid-session) and opens
  the same dialog.

**Why:** a generic "allow mic in settings" toast left users stuck with no idea
where to look, and a cached denial meant Retry never worked after they fixed it.

**How to apply:** any new mic entry point must go through the same
`checkMicPermission()`-per-tap → dialog-on-deny flow; don't add a separate
denial toast.
