import { Router, type IRouter } from "express";
import type { Request, Response, NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { asc } from "drizzle-orm";
import { db, userProfilesTable, businessProfilesTable } from "@workspace/db";
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

export default router;
