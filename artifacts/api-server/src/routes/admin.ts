import { Router, type IRouter } from "express";
import type { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { asc, desc, sql } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  businessProfilesTable,
  couponsTable,
} from "@workspace/db";
import { ListAdminUsersResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { syncUsersFromClerk } from "../lib/user-sync";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// Server-side gate: the signed-in user's primary email (as reported by
// Clerk, not by the client) must be listed in ADMIN_EMAILS.
async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const allowed = adminEmails();
    if (allowed.length === 0) {
      res.status(403).json({ error: "Admin access is not configured" });
      return;
    }
    const userId = (req as AuthedRequest).userId;
    const user = await clerkClient.users.getUser(userId);
    const email = (
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      ""
    ).toLowerCase();
    if (!email || !allowed.includes(email)) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch (err) {
    logger.error({ err }, "Admin check failed");
    res.status(403).json({ error: "Admin access required" });
  }
}

router.get(
  "/admin/users",
  requireAuth,
  requireAdmin,
  async (_req, res): Promise<void> => {
    // Refresh the mirror from Clerk on every admin load so the table is
    // always current (user counts are small; this is a couple of API calls).
    await syncUsersFromClerk();

    const users = await db
      .select()
      .from(userProfilesTable)
      .orderBy(asc(userProfilesTable.registeredAt));
    const businesses = await db
      .select({
        userId: businessProfilesTable.userId,
        businessName: businessProfilesTable.businessName,
      })
      .from(businessProfilesTable)
      .orderBy(asc(businessProfilesTable.id));

    const businessesByUser = new Map<string, string[]>();
    for (const b of businesses) {
      const list = businessesByUser.get(b.userId) ?? [];
      list.push(b.businessName);
      businessesByUser.set(b.userId, list);
    }

    const rows = users.map((u) => ({
      userId: u.userId,
      email: u.email,
      signupMethod: u.signupMethod,
      registeredAt: u.registeredAt,
      closedAt: u.closedAt,
      marketingConsent: u.marketingConsent,
      businesses: businessesByUser.get(u.userId) ?? [],
    }));

    res.json(ListAdminUsersResponse.parse(rows));
  },
);

// ---- Coupons (lean v1: no portal UI; owner creates codes via these
// endpoints because direct SQL inserts only work in development — the
// production DB is read-only from outside the app) ----

function serializeCoupon(c: typeof couponsTable.$inferSelect) {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    freeTrialDays: c.freeTrialDays,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    userId: c.userId,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    isActive: c.isActive,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
  };
}

router.post(
  "/admin/coupons",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const adminId = (req as AuthedRequest).userId;
    const body = req.body as {
      code?: string;
      description?: string | null;
      freeTrialDays?: number;
      maxUses?: number | null;
      userId?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
    };

    const code = (body.code ?? "").trim();
    const freeTrialDays = Number(body.freeTrialDays);
    if (!code || !Number.isInteger(freeTrialDays) || freeTrialDays < 1) {
      res.status(400).json({
        error: "code and freeTrialDays (positive integer) are required",
      });
      return;
    }
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      res.status(400).json({ error: "expiresAt must be a valid ISO timestamp" });
      return;
    }

    const [created] = await db
      .insert(couponsTable)
      .values({
        code,
        description: body.description ?? null,
        discountType: "free_trial",
        freeTrialDays,
        maxUses: body.maxUses ?? null,
        userId: body.userId ?? null,
        expiresAt,
        isActive: body.isActive ?? true,
        createdBy: adminId,
      })
      .onConflictDoNothing({ target: couponsTable.code })
      .returning();
    if (!created) {
      res.status(409).json({ error: "A coupon with this code already exists" });
      return;
    }
    res.json(serializeCoupon(created));
  },
);

router.get(
  "/admin/coupons",
  requireAuth,
  requireAdmin,
  async (_req, res): Promise<void> => {
    const coupons = await db
      .select()
      .from(couponsTable)
      .orderBy(desc(couponsTable.createdAt));
    res.json(coupons.map(serializeCoupon));
  },
);

// ---- TEMPORARY: one-time production data reset ----
// The production DB is read-only from outside the app, so this token-guarded
// route lets the deployed app wipe the dev/test data carried into production.
// REMOVE this route (and the ADMIN_RESET_TOKEN secret) after the reset runs.
router.post("/admin/reset-all-data", async (req, res): Promise<void> => {
  const { timingSafeEqual } = await import("node:crypto");
  const expected = process.env.ADMIN_RESET_TOKEN ?? "";
  const provided = req.get("x-admin-reset-token") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.execute(sql`
    TRUNCATE public.business_profiles, public.conversations,
             public.coupon_redemptions, public.coupons,
             public.credit_purchases, public.email_records,
             public.email_templates, public.messages, public.quotes,
             public.templates, public.usage_counters, public.user_profiles
    RESTART IDENTITY CASCADE
  `);
  logger.warn("Production data reset executed via admin token");
  res.json({ ok: true });
});

export default router;
