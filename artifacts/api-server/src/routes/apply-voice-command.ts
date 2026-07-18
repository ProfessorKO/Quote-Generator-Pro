import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ApplyVoiceCommandBody, ApplyVoiceCommandResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import {
  getBillingStatus,
  consumeAction,
  LimitReachedError,
  limitReachedResponse,
} from "../lib/billing";
import { upsertCurrentUser } from "../lib/user-sync";

const router: IRouter = Router();

router.post("/apply-voice-command", requireAuth, async (req, res): Promise<void> => {
  const parsed = ApplyVoiceCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Voice edits are metered, but per spec only SUCCESSFUL applications count.
  // Cheap pre-check here rejects users already at their limit before we spend
  // an AI call; the actual consumption happens after a successful apply.
  const userId = (req as AuthedRequest).userId;
  await upsertCurrentUser(userId);
  const billing = await getBillingStatus(userId);
  if (
    billing.plan === "free" &&
    billing.credits === 0 &&
    billing.usage.voiceEdits >= billing.limits.voiceEdits
  ) {
    res.status(402).json(limitReachedResponse("voiceEdits"));
    return;
  }

  const { command, lineItems, settings } = parsed.data;

  const systemPrompt = `You are a voice assistant that edits an Australian tradesperson's quote.
The user speaks a command and you apply it to the CURRENT quote state, then return the COMPLETE updated quote.

IMPORTANT: a line item's NAME/DESCRIPTION shown to the user is its "label" field.
When the user renames an item or changes its description, you update "label".

You can:
- Change a line item's unitPrice, quantity, label, or unit
- RENAME a line item / change its name or description: update that line item's "label"
  (NOT the "description" field). The user may say "rename", "change name",
  "change description", "call it", etc. Identify the target item by position
  ("item 1", "the first item"), by its current name, or by context. Capitalise the
  new name sensibly and DO NOT change unitPrice, quantity, unit or overtimePercent
  when only renaming. Examples:
  - "Rename item 1 to canapes" → set the FIRST line item's label to "Canapes"
  - "Change description to prawn skewers" → set the relevant line item's label to "Prawn skewers"
  - "Rename canapes to crostini" → find the item whose label is "Canapes" and set its label to "Crostini"
  - "Change item name to mini quiches" → set the relevant line item's label to "Mini quiches"
- Apply OVERTIME to a line item as a PERCENTAGE MARKUP on its base rate:
  - "overtimePercent" is a percentage added on top of the base unitPrice. The
    effective charged rate = unitPrice + (unitPrice * overtimePercent / 100).
    Example: base unitPrice 80 with overtimePercent 10 charges 88 per unit.
  - "overtime 10%" / "change overtime to 15%" / "add 20 percent overtime" → set
    that line item's overtimePercent to the spoken number. DO NOT change unitPrice
    (unitPrice always stays the BASE rate).
  - "remove overtime" / "no overtime" → set overtimePercent to 0.
  - NEVER bake the overtime into unitPrice and NEVER set overtimePercent to a raw
    dollar amount — it is strictly a percentage.
- Convert a "fixed" charge to "variable" or vice versa:
  - Variable means priced per unit (e.g. unit "hour" or "metre", quantity adjustable, unitPrice is the per-unit rate)
  - Fixed means a flat charge (set unit to "each", quantity to 1, unitPrice to the flat amount)
- Add a new line item (generate a short id, a sensible label, unit, unitPrice, quantity default 1, and a voiceKey)
- Add a discount or deduction that reduces the subtotal: represent it as a line item with a NEGATIVE unitPrice (e.g. a $50 discount = unitPrice -50, quantity 1, unit "each", label "Discount"). A percentage discount must be converted to a negative dollar amount based on the current subtotal.
- Remove a line item
- Toggle GST on/off (settings.includeGst) — GST rate is always 0.10
- Turn the call-out fee on/off (settings.hasCallOut) and set its amount (settings.callOutFee)
- Turn the public holiday surcharge on/off (settings.isPublicHoliday) and set its percent (settings.publicHolidaySurchargePercent)

Rules:
- Preserve every existing line item id unless the item is removed
- Keep all existing fields you are not changing exactly as they are
- Every line item MUST keep a voiceKey (reuse the existing one, or create one for new items)
- If you cannot understand the command or it does not map to any change, set "understood" to false, return the quote UNCHANGED, and explain in "message"
- "message" must be one short sentence describing what you did (or why you could not)
- Output valid JSON only, no markdown

Output this exact JSON structure:
{
  "lineItems": [ { "id": "...", "label": "...", "description": null, "unit": "...", "unitPrice": 0, "quantity": 1, "voiceKey": "...", "overtimePercent": 0 } ],
  "settings": { "includeGst": true, "gstRate": 0.10, "callOutFee": 0, "publicHolidaySurchargePercent": 0, "isPublicHoliday": false, "hasCallOut": false },
  "message": "string",
  "understood": true
}`;

  const userContent = JSON.stringify({ command, currentQuote: { lineItems, settings } });

  let content: string;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });
    content = response.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    req.log.error({ err }, "OpenAI request failed for voice command");
    res.json({
      lineItems,
      settings,
      message: "Sorry, the assistant is unavailable right now. Please try again.",
      understood: false,
    });
    return;
  }

  let result: unknown;
  try {
    result = JSON.parse(content);
  } catch {
    req.log.error({ content }, "Failed to parse OpenAI JSON response");
    res.json({
      lineItems,
      settings,
      message: "Sorry, I couldn't apply that command. Please try again.",
      understood: false,
    });
    return;
  }

  // Non-negative only (quantities, fees, percentages).
  const clampNumber = (value: unknown, fallback: number): number => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
  };

  // Allow negatives (e.g. discounts use a negative unitPrice) but reject invalid numbers.
  const sanitizeSigned = (value: unknown, fallback: number): number => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return n;
  };

  const raw = result as any;
  if (Array.isArray(raw?.lineItems)) {
    raw.lineItems = raw.lineItems.map((item: any, index: number) => ({
      ...item,
      id: item.id || `item-${index + 1}`,
      quantity: clampNumber(item.quantity, 1),
      unitPrice: sanitizeSigned(item.unitPrice, 0),
      overtimePercent: clampNumber(item.overtimePercent, 0),
      unit: item.unit ?? "each",
      voiceKey: item.voiceKey ?? item.label ?? `item ${index + 1}`,
      description: item.description ?? null,
    }));
  }

  // Enforce Australian tax invariants regardless of what the model returned.
  if (raw?.settings && typeof raw.settings === "object") {
    raw.settings.gstRate = 0.1;
    raw.settings.callOutFee = clampNumber(raw.settings.callOutFee, 0);
    raw.settings.publicHolidaySurchargePercent = clampNumber(
      raw.settings.publicHolidaySurchargePercent,
      0,
    );
  }

  const validated = ApplyVoiceCommandResponse.safeParse(raw);
  if (!validated.success) {
    req.log.warn({ errors: validated.error.message, raw }, "AI voice command response did not match schema");
    // Fall back to returning the original quote unchanged
    res.json({
      lineItems,
      settings,
      message: "Sorry, I couldn't apply that command. Please try again.",
      understood: false,
    });
    return;
  }

  // Consume the voice-edit quota ONLY when the command was actually
  // understood and applied — schema-valid "understood: false" responses and
  // the fallback above are free retries for the user.
  if (validated.data.understood) {
    try {
      await consumeAction(userId, "voiceEdits");
    } catch (err) {
      if (err instanceof LimitReachedError) {
        res.status(402).json(limitReachedResponse("voiceEdits"));
        return;
      }
      throw err;
    }
  }

  res.json(validated.data);
});

export default router;
