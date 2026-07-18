import { getUncachableStripeClient } from "./stripeClient";
import type Stripe from "stripe";

/**
 * Creates the QuoteCraft billing catalog in Stripe (idempotent):
 *  - Pro Plan: $4.99 AUD/month recurring subscription
 *  - Credit packs (one-time): 10/$2, 20/$4, 50/$10, 100/$20 AUD
 *
 * Custom attributes live in Stripe metadata (the stripe.* schema in Postgres
 * is a read-only mirror synced by stripe-replit-sync).
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/seed-stripe-products.ts
 */

const CREDIT_PACKS = [
  { credits: 10, amount: 200 },
  { credits: 20, amount: 400 },
  { credits: 50, amount: 1000 },
  { credits: 100, amount: 2000 },
];

async function findProductByKey(stripe: Stripe, key: string) {
  const found = await stripe.products.search({
    query: `metadata['quotecraft_key']:'${key}' AND active:'true'`,
  });
  return found.data[0] ?? null;
}

async function main() {
  const stripe = await getUncachableStripeClient();

  // Pro Plan subscription
  let pro = await findProductByKey(stripe, "pro_plan");
  if (pro) {
    console.log(`Pro Plan already exists (${pro.id})`);
  } else {
    pro = await stripe.products.create({
      name: "QuoteCraft Pro",
      description:
        "Unlimited templates, new quotes, voice edits, emails and PDF downloads.",
      metadata: { quotecraft_key: "pro_plan", type: "subscription" },
    });
    const price = await stripe.prices.create({
      product: pro.id,
      unit_amount: 499,
      currency: "aud",
      recurring: { interval: "month" },
    });
    console.log(`Created Pro Plan ${pro.id} price ${price.id} ($4.99 AUD/mo)`);
  }

  // Credit packs (one-time)
  for (const pack of CREDIT_PACKS) {
    const key = `credits_${pack.credits}`;
    const existing = await findProductByKey(stripe, key);
    if (existing) {
      console.log(`${pack.credits}-credit pack already exists (${existing.id})`);
      continue;
    }
    const product = await stripe.products.create({
      name: `${pack.credits} Credits`,
      description: `${pack.credits} QuoteCraft credits. 1 credit = 1 action (new quote, voice edit, email or PDF download). Credits never expire.`,
      metadata: {
        quotecraft_key: key,
        type: "credit_pack",
        credits: String(pack.credits),
      },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.amount,
      currency: "aud",
    });
    console.log(
      `Created ${pack.credits}-credit pack ${product.id} price ${price.id} ($${(pack.amount / 100).toFixed(2)} AUD)`,
    );
  }

  console.log("Done. Webhooks/backfill will sync the catalog to Postgres.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
