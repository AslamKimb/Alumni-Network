import type { Database } from "@Alumni-Network/db";
import * as schema from "@Alumni-Network/db/schema/auth";
import {
  DOMAIN_NOT_ALLOWED_MESSAGE,
  SIGNUPS_CLOSED_MESSAGE,
  isEmailDomainAllowed,
  readAuthSettings,
} from "@Alumni-Network/db/settings";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { and, eq, isNull } from "drizzle-orm";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  ADMIN_EMAILS?: string;
};

const LAST_ADMIN_MESSAGE = "The last remaining admin cannot be demoted, deactivated, or deleted.";

function isListedAdmin(env: AuthConfig, email: string) {
  const listed = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return listed.includes(email.trim().toLowerCase());
}

async function activeAdminIds(database: Database) {
  const rows = await database
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(eq(schema.user.role, "admin"), isNull(schema.user.deactivatedAt)));
  return rows;
}

async function findAccount(database: Database, userId: string) {
  const [account] = await database
    .select({
      id: schema.user.id,
      email: schema.user.email,
      role: schema.user.role,
      deactivatedAt: schema.user.deactivatedAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  return account;
}

// ADMIN_EMAILS bootstraps the first administrator only: once any active admin
// exists, roles are managed in-app so a demotion is never silently reversed.
async function shouldBootstrapAdmin(env: AuthConfig, database: Database, email: string) {
  if (!isListedAdmin(env, email)) return false;
  return (await activeAdminIds(database)).length === 0;
}

// Server components on the web host forward the incoming cookie to the API, so
// the cookie has to be scoped to the domain both hosts share:
// app.example.com -> example.com. Localhost and IPs keep a host-only cookie,
// which already reaches every port.
function sharedCookieDomain(env: AuthConfig) {
  const host = new URL(env.CORS_ORIGIN).hostname;
  if (host === "localhost" || /^\d+(\.\d+){3}$/.test(host)) return undefined;
  const labels = host.split(".");
  return labels.length > 2 ? labels.slice(1).join(".") : host;
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = [],
) {
  const cookieDomain = sharedCookieDomain(env);

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      crossSubDomainCookies: cookieDomain ? { enabled: true, domain: cookieDomain } : undefined,
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "alumnus",
          input: false,
        },
        deactivatedAt: {
          type: "date",
          required: false,
          input: false,
        },
        permissions: {
          type: "string",
          required: false,
          defaultValue: "[]",
          input: false,
        },
      },
      deleteUser: {
        enabled: true,
        beforeDelete: async (account) => {
          const target = await findAccount(database, account.id);
          if (target?.role !== "admin" || target.deactivatedAt) return;
          if ((await activeAdminIds(database)).length <= 1) {
            throw new APIError("FORBIDDEN", { message: LAST_ADMIN_MESSAGE });
          }
        },
      },
      changeEmail: {
        enabled: true,
        // No transactional email provider in the MVP, so the new address is not proven.
        updateEmailWithoutVerification: true,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (account, context) => {
            const bootstrapAdmin = await shouldBootstrapAdmin(env, database, account.email);
            if (context?.path === "/sign-up/email") {
              if (context.body?.consent !== true) {
                throw new APIError("BAD_REQUEST", { message: "Consent is required." });
              }
              if (account.name.length < 2 || account.name.length > 120) {
                throw new APIError("BAD_REQUEST", { message: "Name must be 2–120 characters." });
              }
              const settings = await readAuthSettings(database);
              // The listed bootstrap admin must still get in when sign-ups are closed,
              // otherwise the office could lock itself out for good.
              if (!settings.signupsOpen && !bootstrapAdmin) {
                throw new APIError("FORBIDDEN", { message: SIGNUPS_CLOSED_MESSAGE });
              }
              if (!isEmailDomainAllowed(settings.allowedEmailDomains, account.email)) {
                throw new APIError("BAD_REQUEST", { message: DOMAIN_NOT_ALLOWED_MESSAGE });
              }
            }
            if (!bootstrapAdmin) return;
            return { data: { ...account, role: "admin" } };
          },
          after: async (account, context) => {
            if (context?.path !== "/sign-up/email" || context.body?.consent !== true) return;
            try {
              await database
                .insert(schema.alumniProfile)
                .values({
                  userId: account.id,
                  fullName: account.name,
                  consentAt: new Date(),
                })
                .onConflictDoNothing({ target: schema.alumniProfile.userId });
            } catch {
              try {
                await database.delete(schema.user).where(eq(schema.user.id, account.id));
              } catch {
                // The failure response stays generic; database errors may contain personal data.
              }
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "Unable to complete sign up. Please try again.",
              });
            }
          },
        },
      },
      session: {
        create: {
          before: async (newSession) => {
            const account = await findAccount(database, newSession.userId);
            if (!account) {
              throw new APIError("UNAUTHORIZED", { message: "Account not found." });
            }
            if (account.deactivatedAt) {
              throw new APIError("FORBIDDEN", {
                message: "This account has been deactivated. Contact an administrator.",
              });
            }
            if (
              account.role !== "admin" &&
              (await shouldBootstrapAdmin(env, database, account.email))
            ) {
              await database
                .update(schema.user)
                .set({ role: "admin" })
                .where(eq(schema.user.id, account.id));
            }
          },
        },
      },
    },
    plugins: [],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
