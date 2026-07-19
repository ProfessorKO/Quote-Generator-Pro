import { Router, type IRouter } from "express";
import type { Request } from "express";
import { sql, eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  creditPurchasesTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import {
  getBillingStatus,
  getSubscriptionInfo,
  consumeAction,
  LimitReachedError,
  limitReachedResponse,
} from "../lib/billing";
import { upsertCurrentUser } from "../lib/user-sync";

const router: IRouter = Router();

interface CatalogRow {
  price_id: string;
  unit_amount: number;
  currency: string;
  quotecraft_key: string;
  credits: string | null;
  recurring: unknown;
}

/** Reads the seeded catalog from the synced stripe.* mirror. */
async function getCatalog(): Promise<CatalogRow[]> {
  const result = await db.execute(sql`
    SELECT pr.id AS price_id,
           pr.unit_amount::int AS unit_amount,
           pr.currency,
           p.metadata ->> 'quotecraft_key' AS quotecraft_key,
           p.metadata ->> 'credits' AS credits,
           pr.recurring
    FROM stripe.prices pr
    JOIN stripe.products p ON p.id = pr.product
    WHERE p.active = true
      AND pr.active = true
      AND p.metadata ? 'quotecraft_key'
  `);
  return result.rows as unknown as CatalogRow[];
}

function appOrigin(req: Request): string {
  const origin = req.get("origin");
  if (origin) return origin;
  const referer = req.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* fall through */
    }
  }
  return `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
}

async function getOrCreateCustomer(userId: string): Promise<string> {
  // Make sure the profile row exists (synced from Clerk).
  await upsertCurrentUser(userId);
  const [profile] = await db
    .select({
      email: userProfilesTable.email,
      stripeCustomerId: userProfilesTable.stripeCustomerId,
    })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  if (!profile) throw new Error("User profile not found");
  if (profile.stripeCustomerId) return profile.stripeCustomerId;

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email: profile.email,
    metadata: { userId },
  });
  await db
    .update(userProfilesTable)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(userProfilesTable.userId, userId));
  return customer.id;
}

// Billing status: plan, credits, usage counters, limits, template count.
router.get("/billing/status", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  await upsertCurrentUser(userId);
  const status = await getBillingStatus(userId);

  const catalog = await getCatalog();
  const creditPacks = catalog
    .filter((row) => row.quotecraft_key.startsWith("credits_"))
    .map((row) => ({
      credits: Number(row.credits),
      priceId: row.price_id,
      unitAmount: row.unit_amount,
      currency: row.currency,
    }))
    .sort((a, b) => a.credits - b.credits);

  res.json({ ...status, creditPacks });
});

// Start a Stripe Checkout session (subscription or credit pack), or resume a
// subscription that was set to cancel at period end.
router.post("/billing/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { type, credits } = req.body as {
    type?: string;
    credits?: number;
  };

  if (type !== "subscription" && type !== "credits") {
    res.status(400).json({ error: "type must be 'subscription' or 'credits'" });
    return;
  }

  const stripe = await getUncachableStripeClient();

  if (type === "subscription") {
    const sub = await getSubscriptionInfo(userId);
    if (sub.plan === "pro" && sub.cancelAtPeriodEnd && sub.subscriptionId) {
      // Resubscribe before the period ends: just un-cancel.
      await stripe.subscriptions.update(sub.subscriptionId, {
        cancel_at_period_end: false,
      });
      res.json({ resumed: true });
      return;
    }
    if (sub.plan === "pro") {
      res.status(409).json({ error: "Already subscribed to Pro" });
      return;
    }
  }

  const catalog = await getCatalog();
  let priceId: string | undefined;
  if (type === "subscription") {
    priceId = catalog.find((row) => row.quotecraft_key === "pro_plan")?.price_id;
  } else {
    if (!credits) {
      res.status(400).json({ error: "credits is required for credit packs" });
      return;
    }
    priceId = catalog.find(
      (row) => row.quotecraft_key === `credits_${credits}`,
    )?.price_id;
  }
  if (!priceId) {
    res.status(500).json({
      error:
        "Billing catalog not available yet. Please try again in a moment.",
    });
    return;
  }

  const customerId = await getOrCreateCustomer(userId);
  const origin = appOrigin(req);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: type === "subscription" ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/settings?checkout=cancelled`,
    metadata: { userId, type },
  });

  res.json({ url: session.url });
});

// Confirm a completed Checkout session (called on redirect back). Idempotent:
// credit fulfillment is keyed on the session id.
router.post("/billing/confirm", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { sessionId } = req.body as { sessionId?: string };
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price.product", "subscription"],
  });

  if (session.metadata?.userId !== userId) {
    res.status(403).json({ error: "Session does not belong to this user" });
    return;
  }
  if (session.payment_status !== "paid") {
    res.status(409).json({ error: "Payment not completed" });
    return;
  }

  if (session.mode === "subscription") {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!subscriptionId) {
      res.status(500).json({ error: "No subscription on session" });
      return;
    }
    await db
      .update(userProfilesTable)
      .set({ stripeSubscriptionId: subscriptionId, updatedAt: new Date() })
      .where(eq(userProfilesTable.userId, userId));
    res.json({ result: "subscription_active" });
    return;
  }

  // Credit pack: read credits from product metadata, fulfill idempotently.
  let creditsToAdd = 0;
  for (const item of session.line_items?.data ?? []) {
    const product = item.price?.product;
    if (product && typeof product === "object" && "metadata" in product) {
      creditsToAdd += Number(product.metadata?.credits ?? 0) * (item.quantity ?? 1);
    }
  }
  if (creditsToAdd <= 0) {
    res.status(500).json({ error: "No credits found on session" });
    return;
  }

  const creditsAdded = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(creditPurchasesTable)
      .values({
        stripeSessionId: session.id,
        userId,
        credits: creditsToAdd,
        amountTotal: session.amount_total ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) return 0; // already fulfilled
    await tx
      .update(userProfilesTable)
      .set({
        credits: sql`${userProfilesTable.credits} + ${creditsToAdd}`,
        updatedAt: new Date(),
      })
      .where(eq(userProfilesTable.userId, userId));
    return creditsToAdd;
  });

  const status = await getBillingStatus(userId);
  res.json({
    result: "credits_added",
    creditsAdded,
    credits: status.credits,
  });
});

// Cancel the Pro subscription at the end of the current billing period.
router.post("/billing/cancel", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { reason } = req.body as { reason?: string };

  const sub = await getSubscriptionInfo(userId);
  if (sub.plan !== "pro" || !sub.subscriptionId) {
    res.status(409).json({ error: "No active subscription" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  await stripe.subscriptions.update(sub.subscriptionId, {
    cancel_at_period_end: true,
    ...(reason
      ? { metadata: { cancel_reason: reason.slice(0, 200) } }
      : {}),
  });

  res.json({
    result: "cancelled_at_period_end",
    currentPeriodEnd: sub.currentPeriodEnd,
  });
});

// PDF generation happens client-side, so the client asks for authorization
// (and consumes quota/credit) right before generating the file.
router.post("/usage/pdf-download", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  await upsertCurrentUser(userId);
  try {
    const result = await consumeAction(userId, "pdfDownloads");
    res.json({ allowed: true, source: result.source, creditsRemaining: result.creditsRemaining });
  } catch (err) {
    if (err instanceof LimitReachedError) {
      res.status(402).json(limitReachedResponse("pdfDownloads"));
      return;
    }
    throw err;
  }
});

export default router;
