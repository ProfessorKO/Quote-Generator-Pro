/**
 * E2E test for the coupon → free Pro trial feature (task: coupon codes).
 * Runs against the DEV database, exercising the real redeemCoupon and
 * getSubscriptionInfo code paths end to end (validation, atomic counters,
 * trial grant, expiry downgrade). All rows are namespaced and cleaned up.
 *
 * Run: ../../scripts/node_modules/.bin/tsx src/test/coupons-e2e.ts
 */
import { sql } from "drizzle-orm";
import { db, userProfilesTable, couponsTable } from "@workspace/db";
import { redeemCoupon, CouponError } from "../lib/coupons";
import { getSubscriptionInfo } from "../lib/billing";

const P = "cpntest_"; // namespace for everything this test creates
const userA = `${P}user_a`;
const userB = `${P}user_b`;
const userC = `${P}user_c`;

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function expectError(
  name: string,
  fn: () => Promise<unknown>,
  code: string,
) {
  try {
    await fn();
    check(name, false, "expected rejection but it succeeded");
  } catch (err) {
    const got = err instanceof CouponError ? err.code : String(err);
    check(name, got === code, `expected ${code}, got ${got}`);
  }
}

async function cleanup() {
  await db.execute(sql`DELETE FROM coupon_redemptions WHERE user_id LIKE ${P + "%"}`);
  await db.execute(
    sql`DELETE FROM coupon_redemptions WHERE coupon_id IN (SELECT id FROM coupons WHERE code LIKE ${P + "%"})`,
  );
  await db.execute(sql`DELETE FROM coupons WHERE code LIKE ${P + "%"}`);
  await db.execute(sql`DELETE FROM user_profiles WHERE user_id LIKE ${P + "%"}`);
}

async function main() {
  await cleanup();

  for (const uid of [userA, userB, userC]) {
    await db
      .insert(userProfilesTable)
      .values({ userId: uid, email: `${uid}@example.test` });
  }
  const day = 24 * 60 * 60 * 1000;
  await db.insert(couponsTable).values([
    { code: `${P}PUBLIC30`, freeTrialDays: 30, maxUses: 5 },
    { code: `${P}USERSPEC`, freeTrialDays: 14, userId: userC },
    { code: `${P}EXPIRED`, freeTrialDays: 30, expiresAt: new Date(Date.now() - day) },
    { code: `${P}MAXED`, freeTrialDays: 30, maxUses: 1, usedCount: 1 },
    { code: `${P}INACTIVE`, freeTrialDays: 30, isActive: false },
  ]);

  // 1. Valid public code → Pro trial granted, derived plan is pro/trial.
  const r1 = await redeemCoupon(userA, `${P}public30`); // case-insensitive
  check("public code grants trial", r1.trialDays === 30);
  const subA = await getSubscriptionInfo(userA);
  check(
    "billing derives pro (source trial)",
    subA.plan === "pro" && subA.source === "trial" && !!subA.trialEndsAt,
    JSON.stringify(subA),
  );
  const [{ used_count }] = (
    await db.execute(sql`SELECT used_count FROM coupons WHERE code = ${P + "PUBLIC30"}`)
  ).rows as [{ used_count: number }];
  check("used_count incremented", used_count === 1);

  // 2. User-specific mismatch → same message/code as unknown coupon.
  await expectError(
    "user-specific mismatch rejected",
    () => redeemCoupon(userB, `${P}USERSPEC`),
    "INVALID_CODE",
  );
  const r2 = await redeemCoupon(userC, `${P}USERSPEC`);
  check("user-specific match redeems", r2.trialDays === 14);

  // 3. Expired coupon.
  await expectError(
    "expired coupon rejected",
    () => redeemCoupon(userB, `${P}EXPIRED`),
    "EXPIRED",
  );

  // 4. Max uses reached.
  await expectError(
    "max uses reached rejected",
    () => redeemCoupon(userB, `${P}MAXED`),
    "MAX_USES_REACHED",
  );

  // 4b. Inactive + unknown codes.
  await expectError(
    "inactive coupon rejected",
    () => redeemCoupon(userB, `${P}INACTIVE`),
    "INVALID_CODE",
  );
  await expectError(
    "unknown code rejected",
    () => redeemCoupon(userB, `${P}NOPE`),
    "INVALID_CODE",
  );

  // 5. Already Pro (active trial) cannot redeem again.
  await expectError(
    "already-pro (trial) cannot redeem",
    () => redeemCoupon(userA, `${P}PUBLIC30`),
    "ALREADY_PRO",
  );

  // 6. Trial expiry → auto-downgrade to free (pure derivation, no cron).
  await db.execute(
    sql`UPDATE user_profiles SET trial_ends_at = now() - interval '1 day' WHERE user_id = ${userA}`,
  );
  const subExpired = await getSubscriptionInfo(userA);
  check(
    "expired trial derives free",
    subExpired.plan === "free" && subExpired.source === "none",
    JSON.stringify(subExpired),
  );

  // 7. Double redemption blocked even after the trial lapsed.
  await expectError(
    "double redemption rejected",
    () => redeemCoupon(userA, `${P}PUBLIC30`),
    "ALREADY_REDEEMED",
  );

  await cleanup();
  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
