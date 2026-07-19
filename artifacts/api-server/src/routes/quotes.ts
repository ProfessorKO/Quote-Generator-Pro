import { Router, type IRouter } from "express";
import { and, eq, ilike, desc, sql, type SQL } from "drizzle-orm";
import { db, quotesTable } from "@workspace/db";
import {
  ListQuotesResponse,
  GetQuoteParams,
  GetQuoteResponse,
  CreateQuoteBody,
  GetNextQuoteSequenceResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/quotes", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { clientName, clientEmail, clientSuburb, sentMonth } = req.query;

  const conditions: SQL[] = [eq(quotesTable.userId, userId)];
  if (typeof clientName === "string" && clientName.trim()) {
    conditions.push(ilike(quotesTable.clientName, `%${clientName.trim()}%`));
  }
  if (typeof clientEmail === "string" && clientEmail.trim()) {
    conditions.push(ilike(quotesTable.clientEmail, `%${clientEmail.trim()}%`));
  }
  if (typeof clientSuburb === "string" && clientSuburb.trim()) {
    conditions.push(ilike(quotesTable.clientSuburb, `%${clientSuburb.trim()}%`));
  }
  if (typeof sentMonth === "string" && /^\d{4}-\d{2}$/.test(sentMonth)) {
    conditions.push(
      sql`to_char(${quotesTable.sentAt}, 'YYYY-MM') = ${sentMonth}`,
    );
  }

  const quotes = await db
    .select()
    .from(quotesTable)
    .where(and(...conditions))
    .orderBy(desc(quotesTable.createdAt));

  res.json(ListQuotesResponse.parse(quotes));
});

// NOTE: must be registered before /quotes/:id so "next-sequence" isn't
// parsed as a quote id.
router.get(
  "/quotes/next-sequence",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const year = new Date().getFullYear();

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotesTable)
      .where(
        and(
          eq(quotesTable.userId, userId),
          sql`extract(year from ${quotesTable.createdAt}) = ${year}`,
        ),
      );

    const sequence = (row?.count ?? 0) + 1;
    res.json(
      GetNextQuoteSequenceResponse.parse({
        year,
        sequence,
        formatted: String(sequence).padStart(3, "0"),
      }),
    );
  },
);

router.get("/quotes/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = GetQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.id, params.data.id), eq(quotesTable.userId, userId)));

  if (!quote) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  res.json(GetQuoteResponse.parse(quote));
});

router.post("/quotes", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [quote] = await db
    .insert(quotesTable)
    .values({
      userId,
      label: parsed.data.label,
      clientName: parsed.data.clientName ?? null,
      clientEmail: parsed.data.clientEmail ?? null,
      clientAddress: parsed.data.clientAddress ?? null,
      clientSuburb: parsed.data.clientSuburb ?? null,
      lineItems: parsed.data.lineItems as any,
      settings: parsed.data.settings as any,
      total: parsed.data.total,
      source: parsed.data.source,
    })
    .returning();

  res.status(201).json(GetQuoteResponse.parse(quote));
});

export default router;
