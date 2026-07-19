---
name: Voice/mic overlay lifecycle
description: Why a full-screen mic overlay must not tie its teardown to isListening
---

A blocking full-screen overlay/scroll-lock driven by Web Speech `SpeechRecognition` must NOT depend on an `isListening`-style flag for teardown.

**Why:** `recognition.start()` can throw *synchronously* (permission denied / NotAllowedError / InvalidState). When it throws, no `onstart`/`onend`/`onerror` events fire, so any teardown wired only to `onEnd` never runs and `isListening` never becomes true. If `stopListening()` is gated on `isListening`, the 30 s expiry timer and the Stop/Cancel buttons all become no-ops → the overlay stays open and `document.body.style.overflow` stays `hidden` forever (screen permanently locked).

**How to apply:**
- In the speech hook, the `start()` catch block must invoke the `onEnd` callback (and toast) so the caller tears down its overlay immediately.
- `stopListening()` must attempt `recognition.stop()` whenever the recognition object exists, not gated on `isListening` (wrap in try/catch for already-stopped state).
- Keep two separate 30 s timers with distinct meaning: one for the LISTENING/speaking window (auto-stops capture on mic tap), one as a PROCESSING safety unlock for the AI step. Don't conflate them.
- Use `continuous=true` for a multi-second capture window so natural pauses don't end recognition early.

**Transcript handoff on Stop:** the value handed to the parent on Stop/Done must be the FULL visible transcript (finalized chunks + current interim), not just the finalized chunks. If you only accumulate `isFinal` results in a ref, the trailing interim words spoken right before Stop are dropped → the input box ends up partially filled. Keep a separate ref mirroring exactly what the overlay displays (finals + interim) and read THAT on finish; Cancel must still discard via the cancelled flag.
