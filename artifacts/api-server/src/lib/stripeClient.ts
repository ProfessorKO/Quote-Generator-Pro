import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

/**
 * Fetches Stripe credentials from the Replit connection API.
 * Not cached -- tokens can rotate, so fetch fresh each time.
 */
async function getStripeCredentials(): Promise<{
  secretKey: string;
  webhookSecret?: string;
}> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
        "Ensure the Stripe integration is connected via the Integrations tab.",
    );
  }

  // Note: the connector_names filter does not reliably return the Stripe
  // connection on this proxy, so fetch all connections and filter locally.
  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = (await resp.json()) as {
    items?: Array<{
      connector_name?: string;
      settings?: {
        secret_key?: string;
        secret?: string;
        webhook_secret?: string;
      };
    }>;
  };
  // The connection can expose multiple Stripe credential sets (sandbox AND
  // live once a live account is linked). Deployments must use the live keys;
  // the workspace uses sandbox. Never just take the first item.
  const stripeItems = (data.items ?? []).filter(
    (item: { connector_name?: string }) => item.connector_name === "stripe",
  );
  const wantLive =
    process.env.REPLIT_DEPLOYMENT === "1" ||
    Boolean(process.env.WEB_REPL_RENEWAL);
  const keyOf = (item: (typeof stripeItems)[number]) =>
    item.settings?.secret_key ?? item.settings?.secret;
  const matching = stripeItems.find((item) => {
    const key = keyOf(item);
    return key && key.startsWith(wantLive ? "sk_live_" : "sk_test_");
  });
  // Fall back to any available key rather than failing outright (e.g. a
  // deployment before the live account is linked).
  const stripeItem = matching ?? stripeItems.find((item) => keyOf(item));
  const settings = stripeItem?.settings;
  const secretKey = settings?.secret_key ?? settings?.secret;

  if (!secretKey) {
    throw new Error(
      "Stripe integration not connected or missing secret key. " +
        "Connect Stripe via the Integrations tab first.",
    );
  }

  return {
    secretKey,
    webhookSecret: settings?.webhook_secret,
  };
}

// Account ID per secret key. Keys map immutably to one account, so this
// cache never goes stale even when credentials rotate or the connection
// is swapped to a different account.
const accountIdCache = new Map<string, string>();

/**
 * Returns the Stripe account ID the current credentials belong to.
 * Used to scope reads of the stripe.* mirror, which retains rows from
 * previously connected accounts.
 */
export async function getStripeAccountId(): Promise<string> {
  const { secretKey } = await getStripeCredentials();
  const cached = accountIdCache.get(secretKey);
  if (cached) return cached;
  const resp = await fetch("https://api.stripe.com/v1/account", {
    headers: { Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) {
    throw new Error(`Failed to resolve Stripe account: ${resp.status}`);
  }
  const account = (await resp.json()) as { id: string };
  accountIdCache.set(secretKey, account.id);
  return account.id;
}

/**
 * Whether the current Stripe credentials are live-mode keys.
 * In deployments the connector hands out live keys; in the workspace it
 * hands out sandbox keys. The stripe.* mirror can contain rows from both
 * modes, so callers must filter by this.
 */
export async function isStripeLiveMode(): Promise<boolean> {
  const { secretKey } = await getStripeCredentials();
  return secretKey.startsWith("sk_live_");
}

/**
 * Returns a fresh authenticated Stripe client.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}
