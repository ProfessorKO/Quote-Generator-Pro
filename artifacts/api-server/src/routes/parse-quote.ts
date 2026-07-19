import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ParseQuoteDescriptionBody, ParseQuoteDescriptionResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import {
  consumeAction,
  LimitReachedError,
  limitReachedResponse,
} from "../lib/billing";
import { upsertCurrentUser } from "../lib/user-sync";

const router: IRouter = Router();

router.post("/parse-quote", requireAuth, async (req, res): Promise<void> => {
  const parsed = ParseQuoteDescriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Generating a quote from scratch is a metered "new quote" action:
  // Pro = unlimited, otherwise 1 credit, otherwise free-tier allowance.
  const userId = (req as AuthedRequest).userId;
  await upsertCurrentUser(userId);
  try {
    await consumeAction(userId, "newQuotes");
  } catch (err) {
    if (err instanceof LimitReachedError) {
      res.status(402).json(limitReachedResponse("newQuotes"));
      return;
    }
    throw err;
  }

  const { description } = parsed.data;

  const systemPrompt = `You are a quoting assistant for Australian tradespeople and small business owners.
The user will describe their business and pricing in natural language.
You must extract structured quote line items and settings from their description.

Rules:
- Extract each service/material as a separate line item
- For each line item provide: id (uuid-style string), label (short name), unit (hour/meter/each/kg/litre/etc), unitPrice (number), quantity (default 1), voiceKey (a natural spoken keyword or phrase to identify this item, e.g. "labour hours", "pipe length", "call out")
- For Australian businesses, default includeGst to true, gstRate to 0.10
- Set callOutFee if mentioned, else 0
- Set publicHolidaySurchargePercent if mentioned, else 0
- isPublicHoliday and hasCallOut default to false
- Extract business name if mentioned
- Always output valid JSON only, no markdown

Output this exact JSON structure:
{
  "businessName": "string or null",
  "lineItems": [
    {
      "id": "item-1",
      "label": "Labour",
      "description": null,
      "unit": "hour",
      "unitPrice": 85,
      "quantity": 1,
      "voiceKey": "labour hours"
    }
  ],
  "settings": {
    "includeGst": true,
    "gstRate": 0.10,
    "callOutFee": 0,
    "publicHolidaySurchargePercent": 0,
    "isPublicHoliday": false,
    "hasCallOut": false
  }
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: description },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  let result: unknown;
  try {
    result = JSON.parse(content);
  } catch {
    req.log.error({ content }, "Failed to parse OpenAI JSON response");
    res.status(500).json({ error: "Failed to parse AI response" });
    return;
  }

  // Ensure IDs are unique strings if not provided
  const raw = result as any;
  if (Array.isArray(raw?.lineItems)) {
    raw.lineItems = raw.lineItems.map((item: any, index: number) => ({
      ...item,
      id: item.id || `item-${index + 1}`,
      quantity: item.quantity ?? 1,
      overtimePercent: Number.isFinite(Number(item.overtimePercent)) && Number(item.overtimePercent) >= 0
        ? Number(item.overtimePercent)
        : 0,
      description: item.description ?? null,
    }));
  }

  const validated = ParseQuoteDescriptionResponse.safeParse(raw);
  if (!validated.success) {
    req.log.warn({ errors: validated.error.message, raw }, "AI response did not match schema");
    // Return the raw result with defaults if schema validation fails
    res.json({
      businessName: raw?.businessName ?? null,
      lineItems: raw?.lineItems ?? [],
      settings: {
        includeGst: true,
        gstRate: 0.10,
        callOutFee: raw?.settings?.callOutFee ?? 0,
        publicHolidaySurchargePercent: raw?.settings?.publicHolidaySurchargePercent ?? 0,
        isPublicHoliday: false,
        hasCallOut: false,
        ...raw?.settings,
      },
    });
    return;
  }

  res.json(validated.data);
});

export default router;
