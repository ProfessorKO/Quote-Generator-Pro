import { trackFunnelEvent } from "@workspace/api-client-react";

/**
 * Lightweight, privacy-friendly funnel tracking (landing → try → quote →
 * gated action → signup). Events are fire-and-forget: tracking must never
 * break or slow down the app, so every failure is swallowed.
 *
 * The visitor id is a random UUID stored in localStorage — it identifies a
 * browser, not a person, and contains no personal data. It also feeds the
 * signed-out 3-per-day AI limit on the server.
 */

const VISITOR_KEY = "quotecraft:visitor-id";

export type FunnelEventType =
  | "landing_view"
  | "try_it_click"
  | "quote_created"
  | "gated_action"
  | "signup_completed";

export type GatedActionKind = "pdf" | "email" | "save_template";

export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v || v.length < 8) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    // Storage unavailable (private mode etc.) — still a valid >=8 char id;
    // the server falls back to IP-based limiting for these.
    return "no-storage";
  }
}

export function trackEvent(
  eventType: FunnelEventType,
  metadata?: { action?: GatedActionKind },
): void {
  try {
    void trackFunnelEvent({
      eventType,
      visitorId: getVisitorId(),
      ...(metadata ? { metadata } : {}),
    }).catch(() => {
      /* never surface tracking failures */
    });
  } catch {
    /* never surface tracking failures */
  }
}

/**
 * True when an API error is the signed-out daily AI limit (429
 * ANON_DAILY_LIMIT_REACHED) — the app should show the create-account dialog.
 */
export function isAnonDailyLimit(err: unknown): boolean {
  const e = err as { status?: number; data?: { code?: string } } | null;
  return e?.status === 429 && e?.data?.code === "ANON_DAILY_LIMIT_REACHED";
}
