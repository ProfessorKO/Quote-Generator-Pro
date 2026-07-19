import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailTemplatesTable } from "@workspace/db";
import {
  GetEmailTemplateResponse,
  UpsertEmailTemplateBody,
  UpsertEmailTemplateResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/email-template", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const [template] = await db
    .select()
    .from(emailTemplatesTable)
    .where(eq(emailTemplatesTable.userId, userId));

  if (!template) {
    res.status(404).json({ error: "No email template yet" });
    return;
  }

  res.json(GetEmailTemplateResponse.parse(template));
});

router.put("/email-template", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const parsed = UpsertEmailTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values = {
    subject: parsed.data.subject,
    body: parsed.data.body,
  };

  const [template] = await db
    .insert(emailTemplatesTable)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: emailTemplatesTable.userId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  res.json(UpsertEmailTemplateResponse.parse(template));
});

export default router;
