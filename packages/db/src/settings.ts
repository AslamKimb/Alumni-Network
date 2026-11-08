import { inArray } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "./index";
import { appSetting } from "./schema/setting";

const SIGNUPS_OPEN_KEY = "auth.signups_open";
const ALLOWED_DOMAINS_KEY = "auth.allowed_email_domains";

export const SIGNUPS_CLOSED_MESSAGE =
  "Sign-ups are closed. Contact the alumni office to request an account.";
export const DOMAIN_NOT_ALLOWED_MESSAGE =
  "This email domain is not allowed. Contact the alumni office to request an account.";

export const authSettingsInput = z.object({
  signupsOpen: z.boolean(),
  allowedEmailDomains: z.string().max(500),
});

export type AuthSettingsInput = z.infer<typeof authSettingsInput>;

export type AuthSettings = {
  signupsOpen: boolean;
  allowedEmailDomains: string[];
};

function normalizeDomain(entry: string) {
  return entry
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\.+$/, "");
}

export function parseEmailDomains(raw: string) {
  const domains = raw.split(",").map(normalizeDomain).filter(Boolean);
  return [...new Set(domains)];
}

export function invalidEmailDomains(raw: string) {
  return parseEmailDomains(raw).filter(
    (domain) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain),
  );
}

export function isEmailDomainAllowed(allowedEmailDomains: string[], email: string) {
  if (allowedEmailDomains.length === 0) return true;
  const domain = email.split("@").pop()?.trim().toLowerCase() ?? "";
  return allowedEmailDomains.includes(domain);
}

// Missing rows mean defaults: sign-ups open, any email domain allowed.
export async function readAuthSettings(db: Database): Promise<AuthSettings> {
  const rows = await db
    .select({ key: appSetting.key, value: appSetting.value })
    .from(appSetting)
    .where(inArray(appSetting.key, [SIGNUPS_OPEN_KEY, ALLOWED_DOMAINS_KEY]));
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    signupsOpen: values.get(SIGNUPS_OPEN_KEY) !== "false",
    allowedEmailDomains: parseEmailDomains(values.get(ALLOWED_DOMAINS_KEY) ?? ""),
  };
}

export async function writeAuthSettings(
  db: Database,
  input: AuthSettingsInput,
  updatedBy: string,
): Promise<AuthSettings> {
  const rows = [
    { key: SIGNUPS_OPEN_KEY, value: String(input.signupsOpen) },
    { key: ALLOWED_DOMAINS_KEY, value: parseEmailDomains(input.allowedEmailDomains).join(",") },
  ];

  for (const row of rows) {
    await db
      .insert(appSetting)
      .values({ ...row, updatedBy })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { value: row.value, updatedBy, updatedAt: new Date() },
      });
  }

  return readAuthSettings(db);
}
