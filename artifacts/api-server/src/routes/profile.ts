import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessProfilesTable } from "@workspace/db";
import {
  GetBusinessProfileResponse,
  UpsertBusinessProfileBody,
  UpsertBusinessProfileResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const [profile] = await db
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId));

  if (!profile) {
    res.status(404).json({ error: "No business profile yet" });
    return;
  }

  res.json(GetBusinessProfileResponse.parse(profile));
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
    marketingConsent: parsed.data.marketingConsent,
  };

  const [profile] = await db
    .insert(businessProfilesTable)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: businessProfilesTable.userId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  res.json(UpsertBusinessProfileResponse.parse(profile));
});

export default router;
