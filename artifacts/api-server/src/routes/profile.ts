import { Router, type IRouter } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { db, businessProfilesTable, userProfilesTable } from "@workspace/db";
import {
  GetBusinessProfileResponse,
  UpsertBusinessProfileBody,
  UpsertBusinessProfileResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { upsertCurrentUser } from "../lib/user-sync";

const router: IRouter = Router();

// Marketing consent is stored per user (user_profiles), not per business —
// these handlers keep the original API contract (marketingConsent in the
// BusinessProfile payloads) so the frontend is unchanged.

async function getConsent(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ marketingConsent: userProfilesTable.marketingConsent })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId));
  return row?.marketingConsent ?? false;
}

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const [profile] = await db
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId))
    .orderBy(asc(businessProfilesTable.id))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "No business profile yet" });
    return;
  }

  const marketingConsent = await getConsent(userId);
  res.json(GetBusinessProfileResponse.parse({ ...profile, marketingConsent }));
});

router.put("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const parsed = UpsertBusinessProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values = {
    businessName: parsed.data.businessName.trim(),
    mobile: parsed.data.mobile.trim(),
    abn: parsed.data.abn.trim(),
    acn: parsed.data.acn?.trim() || null,
    address: parsed.data.address.trim(),
  };

  // Ensure the per-user row exists (synced from Clerk), then record consent
  // on it.
  await upsertCurrentUser(userId);
  await db
    .update(userProfilesTable)
    .set({ marketingConsent: parsed.data.marketingConsent, updatedAt: new Date() })
    .where(eq(userProfilesTable.userId, userId));

  // business_profiles is 1:many per user; this endpoint manages the user's
  // first (currently only) business, so upsert by lookup rather than by a
  // unique constraint. Run inside a transaction holding a per-user advisory
  // lock so concurrent first-time saves cannot both insert and create
  // duplicate "primary" business rows.
  const profile = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`business_profile:${userId}`}))`,
    );

    const [existing] = await tx
      .select({ id: businessProfilesTable.id })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId))
      .orderBy(asc(businessProfilesTable.id))
      .limit(1);

    const [row] = existing
      ? await tx
          .update(businessProfilesTable)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(businessProfilesTable.id, existing.id))
          .returning()
      : await tx
          .insert(businessProfilesTable)
          .values({ userId, ...values })
          .returning();
    return row;
  });

  res.json(
    UpsertBusinessProfileResponse.parse({
      ...profile,
      marketingConsent: parsed.data.marketingConsent,
    }),
  );
});

export default router;
