import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, emailRecordsTable, quotesTable } from "@workspace/db";
import { SendQuoteEmailBody, SendQuoteEmailResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import {
  sendQuoteEmail,
  SendQuoteEmailError,
  type SendFailureReason,
} from "../lib/resend";

const router: IRouter = Router();

// Map a send failure to a client-safe HTTP status + message (Bug #24). The
// generic proxy failure is retryable; config/recipient problems are not.
const FAILURE_RESPONSE: Record<
  SendFailureReason,
  { status: number; error: string }
> = {
  config: {
    status: 503,
    error:
      "Email isn't set up yet. Please connect a verified sending address before emailing quotes.",
  },
  invalid_recipient: {
    status: 422,
    error:
      "That client email address was rejected. Please check it and try again.",
  },
  rate_limited: {
    status: 429,
    error: "Too many emails sent just now. Please wait a moment and try again.",
  },
  unknown: {
    status: 502,
    error: "Couldn't send the email. Please try again.",
  },
};

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

  // Send FIRST. Nothing is persisted until the email actually succeeds, so a
  // failed send never leaves a phantom quote or email record in history (#21).
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
    const reason: SendFailureReason =
      err instanceof SendQuoteEmailError ? err.reason : "unknown";
    const mapped = FAILURE_RESPONSE[reason];
    res.status(mapped.status).json({ error: mapped.error });
    return;
  }

  // Email sent — now record history atomically: create the quote (if the client
  // deferred creation to us via `quote`), then the email record, then stamp the
  // quote's sentAt.
  const record = await db.transaction(async (tx) => {
    let quoteId = data.quoteId ?? null;

    if (data.quote) {
      const [created] = await tx
        .insert(quotesTable)
        .values({
          userId,
          label: data.quote.label,
          clientName: data.quote.clientName ?? null,
          clientEmail: data.quote.clientEmail ?? null,
          clientAddress: data.quote.clientAddress ?? null,
          clientSuburb: data.quote.clientSuburb ?? null,
          lineItems: data.quote.lineItems as any,
          settings: data.quote.settings as any,
          total: data.quote.total,
          source: data.quote.source,
        })
        .returning();
      quoteId = created.id;
    }

    const [inserted] = await tx
      .insert(emailRecordsTable)
      .values({
        userId,
        quoteId,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientSuburb: data.clientSuburb ?? null,
        subject: data.subject,
        body: data.body,
        status: "sent",
      })
      .returning();

    if (quoteId) {
      await tx
        .update(quotesTable)
        .set({ sentAt: new Date() })
        .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.userId, userId)));
    }

    return inserted;
  });

  res.json(SendQuoteEmailResponse.parse(record));
});

export default router;
