import { getUncachableStripeClient } from "./stripeClient";

/**
 * One-off: rebrand the sandbox Stripe catalog from "QuoteCraft" to "Quote Mate".
 * The "Sync Stripe live account with Stripe sandbox" publish toggle copies the
 * sandbox catalog to the live account on publish, so the sandbox is the
 * source of truth for product naming.
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/rename-stripe-products.ts
 */
async function main() {
  const stripe = await getUncachableStripeClient();

  const found = await stripe.products.search({
    query: `metadata['quotecraft_key']:'pro_plan' AND active:'true'`,
  });
  const pro = found.data[0];
  if (!pro) throw new Error("pro_plan product not found in sandbox");

  if (pro.name === "Quote Mate Pro") {
    console.log(`Already renamed (${pro.id})`);
  } else {
    await stripe.products.update(pro.id, {
      name: "Quote Mate Pro",
      description:
        "Unlimited templates, new quotes, voice edits, emails and PDF downloads.",
    });
    console.log(`Renamed ${pro.id}: "${pro.name}" -> "Quote Mate Pro"`);
  }

  // Sanity list
  const all = await stripe.products.list({ limit: 20, active: true });
  for (const p of all.data) {
    console.log(`${p.id}  ${p.name}  livemode=${p.livemode}  key=${p.metadata?.quotecraft_key ?? "-"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
