import { Router, type IRouter } from "express";
import { eq, and, ne, sql } from "drizzle-orm";
import { db, templatesTable } from "@workspace/db";
import {
  CreateTemplateBody,
  GetTemplateParams,
  GetTemplateResponse,
  UpdateTemplateParams,
  UpdateTemplateBody,
  UpdateTemplateResponse,
  DeleteTemplateParams,
  ListTemplatesResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import {
  authorizeTemplateSave,
  LimitReachedError,
  limitReachedResponse,
} from "../lib/billing";
import { upsertCurrentUser } from "../lib/user-sync";

const router: IRouter = Router();

// All template routes are per-user: every query is scoped to the
// authenticated user so one account can never see or touch another's
// templates.

router.get("/templates", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const templates = await db
    .select()
    .from(templatesTable)
    .where(eq(templatesTable.userId, userId))
    .orderBy(templatesTable.updatedAt);
  res.json(ListTemplatesResponse.parse(templates));
});

router.post("/templates", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid template body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = parsed.data.name.trim();

  const duplicate = await db
    .select({ id: templatesTable.id })
    .from(templatesTable)
    .where(
      and(
        eq(templatesTable.userId, userId),
        sql`lower(${templatesTable.name}) = lower(${name})`,
      ),
    );
  if (duplicate.length > 0) {
    res.status(409).json({ error: "A template with this name already exists" });
    return;
  }

  // Free tier: 5 template slots; beyond that a credit is consumed if
  // available, otherwise the save is blocked. Pro is unlimited. The insert
  // runs inside the authorization transaction so the slot check and the
  // insert are atomic (no concurrent free-slot bypass).
  await upsertCurrentUser(userId);
  try {
    const { result: template } = await authorizeTemplateSave(
      userId,
      async (tx) => {
        const [row] = await tx
          .insert(templatesTable)
          .values({
            userId,
            name,
            businessDescription: parsed.data.businessDescription,
            lineItems: parsed.data.lineItems as any,
            settings: parsed.data.settings as any,
          })
          .returning();
        return row;
      },
    );
    res.status(201).json(GetTemplateResponse.parse(template));
  } catch (err) {
    if (err instanceof LimitReachedError) {
      res.status(402).json(limitReachedResponse("templates"));
      return;
    }
    if ((err as { code?: string })?.code === "23505") {
      res.status(409).json({ error: "A template with this name already exists" });
      return;
    }
    throw err;
  }
});

router.get("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = GetTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [template] = await db
    .select()
    .from(templatesTable)
    .where(
      and(
        eq(templatesTable.id, params.data.id),
        eq(templatesTable.userId, userId),
      ),
    );

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.json(GetTemplateResponse.parse(template));
});

// Editing an existing template is never metered — manual edits are free on
// every plan, and templates remain editable after a downgrade.
router.put("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = UpdateTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid update body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = parsed.data.name.trim();

  const duplicate = await db
    .select({ id: templatesTable.id })
    .from(templatesTable)
    .where(
      and(
        eq(templatesTable.userId, userId),
        sql`lower(${templatesTable.name}) = lower(${name})`,
        ne(templatesTable.id, params.data.id),
      ),
    );
  if (duplicate.length > 0) {
    res.status(409).json({ error: "A template with this name already exists" });
    return;
  }

  try {
    const [template] = await db
      .update(templatesTable)
      .set({
        name,
        businessDescription: parsed.data.businessDescription,
        lineItems: parsed.data.lineItems as any,
        settings: parsed.data.settings as any,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(templatesTable.id, params.data.id),
          eq(templatesTable.userId, userId),
        ),
      )
      .returning();

    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.json(UpdateTemplateResponse.parse(template));
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      res.status(409).json({ error: "A template with this name already exists" });
      return;
    }
    throw err;
  }
});

router.delete("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = DeleteTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(templatesTable)
    .where(
      and(
        eq(templatesTable.id, params.data.id),
        eq(templatesTable.userId, userId),
      ),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
