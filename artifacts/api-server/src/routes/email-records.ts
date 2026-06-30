import { Router, type IRouter } from "express";
import { and, eq, ilike, desc, sql, type SQL } from "drizzle-orm";
import { db, emailRecordsTable } from "@workspace/db";
import { ListEmailRecordsResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/email-records", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { clientName, clientEmail, clientSuburb, sentMonth } = req.query;

  const conditions: SQL[] = [eq(emailRecordsTable.userId, userId)];
  if (typeof clientName === "string" && clientName.trim()) {
    conditions.push(ilike(emailRecordsTable.clientName, `%${clientName.trim()}%`));
  }
  if (typeof clientEmail === "string" && clientEmail.trim()) {
    conditions.push(ilike(emailRecordsTable.clientEmail, `%${clientEmail.trim()}%`));
  }
  if (typeof clientSuburb === "string" && clientSuburb.trim()) {
    conditions.push(ilike(emailRecordsTable.clientSuburb, `%${clientSuburb.trim()}%`));
  }
  if (typeof sentMonth === "string" && /^\d{4}-\d{2}$/.test(sentMonth)) {
    conditions.push(
      sql`to_char(${emailRecordsTable.sentAt}, 'YYYY-MM') = ${sentMonth}`,
    );
  }

  const records = await db
    .select()
    .from(emailRecordsTable)
    .where(and(...conditions))
    .orderBy(desc(emailRecordsTable.sentAt));

  res.json(ListEmailRecordsResponse.parse(records));
});

export default router;
