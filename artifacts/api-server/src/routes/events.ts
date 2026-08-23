import { Router, type IRouter } from "express";
import { TrackFunnelEventBody } from "@workspace/api-zod";
import { db, funnelEventsTable } from "@workspace/db";
import { optionalAuth, type AuthedRequest } from "../lib/auth";
import { createAnonRateLimiter } from "../lib/anonRateLimit";

// Funnel events are cheap inserts, but cap EVERYONE'S volume (per IP for
// visitors, per user id when signed in) so no caller can flood the table —
// unlike the AI endpoints, there is no billing meter behind this route.
const eventsRateLimiter = createAnonRateLimiter({
  max: 120,
  windowMs: 60 * 60 * 1000, // 1 hour
  exemptAuthenticated: false,
});

const router: IRouter = Router();

// Fire-and-forget conversion funnel tracking (landing → try → quote →
// gated action → signup). The event type enum is enforced three times:
// OpenAPI spec (client + this zod schema) and a DB CHECK constraint.
router.post("/events", optionalAuth, eventsRateLimiter, async (req, res): Promise<void> => {
  const parsed = TrackFunnelEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = (req as AuthedRequest).userId as string | undefined;

  await db.insert(funnelEventsTable).values({
    eventType: parsed.data.eventType,
    visitorId: parsed.data.visitorId,
    userId: userId ?? null,
    metadata: parsed.data.metadata ?? null,
  });

  res.status(204).end();
});

export default router;
