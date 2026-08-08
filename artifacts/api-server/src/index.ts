import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeSync } from "./lib/stripeClient";

/**
 * Initialize Stripe schema and sync data on startup.
 */
async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required for Stripe integration.",
    );
  }

  logger.info("Initializing Stripe schema...");
  await runMigrations({ databaseUrl });
  logger.info("Stripe schema ready");

  const stripeSync = await getStripeSync();

  logger.info("Setting up managed Stripe webhook...");
  const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  const webhookResult = await stripeSync.findOrCreateManagedWebhook(
    `${webhookBaseUrl}/api/stripe/webhook`,
  );
  logger.info(
    { url: (webhookResult as { url?: string } | undefined)?.url ?? "setup complete" },
    "Stripe webhook configured",
  );

  // syncBackfill() with no params can silently no-op, so force a full
  // catalog backfill explicitly — without it a fresh environment (or a
  // newly linked live account) has no products/prices in the mirror and
  // checkout fails.
  (async () => {
    await stripeSync.syncProducts({ created: { gte: 1 } });
    await stripeSync.syncPrices({ created: { gte: 1 } });
    await stripeSync.syncBackfill().catch(() => undefined);
  })()
    .then(() => logger.info("Stripe data synced"))
    .catch((err) => logger.error({ err }, "Error syncing Stripe data"));
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
