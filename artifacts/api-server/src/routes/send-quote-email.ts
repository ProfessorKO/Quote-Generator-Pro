import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, emailRecordsTable, quotesTable } from "@workspace/db";
import { SendQuoteEmailBody, SendQuoteEmailResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { sendQuoteEmail } from "../lib/resend";

const router: IRouter = Router();

router.post("/send-quote-email", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const parsed = SendQuoteEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const html = data.body
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br/>" : `<p>${line}</p>`))
    .join("");

  try {
    await sendQuoteEmail({
      to: data.clientEmail,
      subject: data.subject,
      html,
      text: data.body,
      attachment:
        data.attachmentBase64 && data.attachmentFilename
          ? {
              filename: data.attachmentFilename,
              contentBase64: data.attachmentBase64,
            }
          : undefined,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send quote email");
    res.status(502).json({ error: "Failed to send the email. Please try again." });
    return;
  }

  const [record] = await db
    .insert(emailRecordsTable)
    .values({
      userId,
      quoteId: data.quoteId ?? null,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientSuburb: data.clientSuburb ?? null,
      subject: data.subject,
      body: data.body,
      status: "sent",
    })
    .returning();

  if (data.quoteId) {
    await db
      .update(quotesTable)
      .set({ sentAt: new Date() })
      .where(
        and(eq(quotesTable.id, data.quoteId), eq(quotesTable.userId, userId)),
      );
  }

  res.json(SendQuoteEmailResponse.parse(record));
});

export default router;
