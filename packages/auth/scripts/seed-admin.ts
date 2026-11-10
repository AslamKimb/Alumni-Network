// Keeps the bootstrap administrator usable from environment variables alone:
// creates the account when it is missing and sets its password on every start
// while ADMIN_PASSWORD is present. Opt-in: without ADMIN_PASSWORD, does nothing.
//
// Runs from deploy/app-start.sh after migrations:
//   bun run packages/auth/scripts/seed-admin.ts
import { createDb } from "@Alumni-Network/db";
import * as schema from "@Alumni-Network/db/schema/auth";
import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";

const password = process.env.ADMIN_PASSWORD;
const url = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAILS?.split(",")[0]?.trim().toLowerCase();

if (!password) {
  console.log("[admin] ADMIN_PASSWORD not set; skipping.");
  process.exit(0);
}
if (!url || !email) {
  console.error("[admin] ADMIN_PASSWORD needs DATABASE_URL and ADMIN_EMAILS.");
  process.exit(1);
}

const db = createDb({ DATABASE_URL: url });
const now = new Date();

const [existing] = await db
  .select({ id: schema.user.id })
  .from(schema.user)
  .where(sql`lower(${schema.user.email}) = ${email}`)
  .limit(1);

const userId = existing?.id ?? crypto.randomUUID();

if (!existing) {
  await db
    .insert(schema.user)
    .values({ id: userId, email, name: email, role: "admin" });
  await db
    .insert(schema.alumniProfile)
    .values({ userId, fullName: email, consentAt: now });
  console.log(`[admin] created ${email}`);
}

// Roles are managed in-app once the first admin exists, so an existing account
// keeps whatever role it has; only the password is enforced here.
const [account] = await db
  .select({ id: schema.account.id })
  .from(schema.account)
  .where(
    and(
      eq(schema.account.userId, userId),
      eq(schema.account.providerId, "credential"),
    ),
  )
  .limit(1);

const hash = await hashPassword(password);

if (account) {
  await db
    .update(schema.account)
    .set({ password: hash, updatedAt: now })
    .where(eq(schema.account.id, account.id));
} else {
  await db.insert(schema.account).values({
    id: crypto.randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });
}

console.log(`[admin] password for ${email} set from ADMIN_PASSWORD`);
process.exit(0);
