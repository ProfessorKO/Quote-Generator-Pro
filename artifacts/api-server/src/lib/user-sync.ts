import { clerkClient } from "@clerk/express";
import type { User } from "@clerk/express";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";

function primaryEmail(user: User): string {
  return (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    ""
  );
}

function signupMethod(user: User): string {
  const hasGoogle = user.externalAccounts?.some((account) =>
    account.provider?.toLowerCase().includes("google"),
  );
  return hasGoogle ? "google" : "email";
}

async function upsertClerkUser(user: User): Promise<void> {
  const values = {
    email: primaryEmail(user),
    signupMethod: signupMethod(user),
    registeredAt: new Date(user.createdAt),
  };
  await db
    .insert(userProfilesTable)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({
      target: userProfilesTable.userId,
      // A user present in Clerk is by definition not closed; clear any stale
      // closedAt. Marketing consent is intentionally untouched here — it is
      // owned by the profile save flow, not the Clerk sync.
      set: { ...values, closedAt: null, updatedAt: new Date() },
    });
}

/**
 * Mirror the current Clerk user list into user_profiles.
 * Rows whose user no longer exists in Clerk get closedAt stamped.
 */
export async function syncUsersFromClerk(): Promise<void> {
  const limit = 100;
  let offset = 0;
  const seenIds: string[] = [];

  for (;;) {
    const { data } = await clerkClient.users.getUserList({
      limit,
      offset,
      orderBy: "+created_at",
    });
    for (const user of data) {
      seenIds.push(user.id);
      await upsertClerkUser(user);
    }
    if (data.length < limit) break;
    offset += limit;
  }

  // Never mass-close: if the listing came back empty (Clerk hiccup or a
  // genuinely empty instance), leave existing rows untouched.
  if (seenIds.length === 0) return;

  // Offset pagination over a mutable remote list can skip users, so a user
  // missing from seenIds is only a *candidate* for closure. Confirm each one
  // individually against Clerk before stamping closedAt.
  const candidates = await db
    .select({ userId: userProfilesTable.userId })
    .from(userProfilesTable)
    .where(
      and(
        isNull(userProfilesTable.closedAt),
        notInArray(userProfilesTable.userId, seenIds),
      ),
    );

  for (const { userId } of candidates) {
    try {
      const user = await clerkClient.users.getUser(userId);
      // Still exists — just missed by pagination drift; refresh the row.
      await upsertClerkUser(user);
    } catch (err) {
      if (isClerkNotFound(err)) {
        await db
          .update(userProfilesTable)
          .set({ closedAt: new Date(), updatedAt: new Date() })
          .where(eq(userProfilesTable.userId, userId));
      } else {
        // Transient error: skip rather than risk a false closure.
        throw err;
      }
    }
  }
}

function isClerkNotFound(err: unknown): boolean {
  const status =
    err && typeof err === "object" && "status" in err
      ? (err as { status?: number }).status
      : undefined;
  return status === 404;
}

/**
 * Ensure a user_profiles row exists for a single signed-in user (used on
 * profile save so consent always has a row to land on).
 */
export async function upsertCurrentUser(userId: string): Promise<void> {
  const user = await clerkClient.users.getUser(userId);
  await upsertClerkUser(user);
}
