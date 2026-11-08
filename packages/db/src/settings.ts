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

// ---- Organization settings (PRODUCT §7.2) ----

export const ORGANIZATION_DEFAULTS = {
  name: "Alumni Network",
  shortName: "",
  description: "",
  logoUrl: "",
  contactEmail: "",
  contactPhone: "",
  websiteUrl: "",
  address: "",
  homeCountry: "",
  timezone: "UTC",
} as const;

export type OrganizationSettings = {
  name: string;
  shortName: string;
  description: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  address: string;
  homeCountry: string;
  timezone: string;
};

// Store key ("organization.name") -> camelCase field.
export const ORGANIZATION_KEYS: Record<string, keyof OrganizationSettings> = {
  "organization.name": "name",
  "organization.short_name": "shortName",
  "organization.description": "description",
  "organization.logo_url": "logoUrl",
  "organization.contact_email": "contactEmail",
  "organization.contact_phone": "contactPhone",
  "organization.website_url": "websiteUrl",
  "organization.address": "address",
  "organization.home_country": "homeCountry",
  "organization.timezone": "timezone",
};

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isIanaTimezone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function isCountryCode(value: string) {
  return /^[A-Za-z]{2}$/.test(value);
}

export const organizationSettingsInput = z.strictObject({
  name: z.string().trim().min(2, "Organization name is required (2–120 characters).").max(120),
  shortName: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || v.length >= 2, "Short name must be 2–20 characters."),
  description: z.string().trim().max(500),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || isHttpsUrl(v), "Logo URL must be a valid HTTPS URL."),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || isValidEmail(v), "Contact email is not valid."),
  contactPhone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || v.length >= 7, "Contact phone must be 7–20 characters."),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || isHttpsUrl(v), "Website URL must be a valid HTTPS URL."),
  address: z.string().trim().max(300),
  homeCountry: z
    .string()
    .trim()
    .refine((v) => v === "" || isCountryCode(v), "Home country must be a 2-letter country code."),
  timezone: z
    .string()
    .trim()
    .transform((v) => v || "UTC")
    .refine(isIanaTimezone, "Timezone must be a valid IANA timezone."),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsInput>;

function normalizeOrganization(input: OrganizationSettingsInput): OrganizationSettings {
  return {
    ...input,
    homeCountry: input.homeCountry.toUpperCase(),
  };
}

export async function readOrganizationSettings(db: Database): Promise<OrganizationSettings> {
  const rows = await db
    .select({ key: appSetting.key, value: appSetting.value })
    .from(appSetting)
    .where(inArray(appSetting.key, Object.keys(ORGANIZATION_KEYS)));
  const values = new Map(rows.map((row) => [row.key, row.value]));

  const result = { ...ORGANIZATION_DEFAULTS } as OrganizationSettings;
  for (const [key, field] of Object.entries(ORGANIZATION_KEYS)) {
    const stored = values.get(key);
    // A stored empty string hides the block; only name/timezone fall back when absent.
    if (stored !== undefined && stored !== "") {
      result[field] = stored;
    } else if (stored === "" && field !== "name" && field !== "timezone") {
      result[field] = "";
    }
  }
  return result;
}

export async function writeOrganizationSettings(
  db: Database,
  input: OrganizationSettingsInput,
  updatedBy: string,
): Promise<OrganizationSettings> {
  const normalized = normalizeOrganization(input);
  const fieldToKey = new Map<keyof OrganizationSettings, string>(
    Object.entries(ORGANIZATION_KEYS).map(([key, field]) => [field, key]),
  );

  for (const [field, value] of Object.entries(normalized) as [
    keyof OrganizationSettings,
    string,
  ][]) {
    const key = fieldToKey.get(field)!;
    await db
      .insert(appSetting)
      .values({ key, value, updatedBy })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { value, updatedBy, updatedAt: new Date() },
      });
  }

  return readOrganizationSettings(db);
}

// ---- Module settings (PRODUCT §7.3) ----

export const MODULE_NAMES = ["profile", "events", "records", "reports"] as const;
export type ModuleName = (typeof MODULE_NAMES)[number];

type ModuleSpec =
  | { field: string; key: string; kind: "boolean"; def: boolean }
  | { field: string; key: string; kind: "int"; def: number; min: number; max: number };

export const MODULE_SPECS: Record<ModuleName, ModuleSpec[]> = {
  profile: [
    { field: "allowEdits", key: "profile.allow_edits", kind: "boolean", def: true },
    { field: "maxDuties", key: "profile.max_duties", kind: "int", def: 10, min: 0, max: 100 },
    { field: "maxEducation", key: "profile.max_education", kind: "int", def: 10, min: 0, max: 100 },
    { field: "allowAccountDeletion", key: "profile.allow_account_deletion", kind: "boolean", def: true },
  ],
  events: [
    { field: "moduleEnabled", key: "events.module_enabled", kind: "boolean", def: true },
    { field: "showPastEvents", key: "events.show_past_events", kind: "boolean", def: true },
  ],
  records: [
    { field: "moduleEnabled", key: "records.module_enabled", kind: "boolean", def: true },
    { field: "exportEnabled", key: "records.export_enabled", kind: "boolean", def: true },
    { field: "includePhoneInExport", key: "records.include_phone_in_export", kind: "boolean", def: false },
  ],
  reports: [
    { field: "moduleEnabled", key: "reports.module_enabled", kind: "boolean", def: true },
    { field: "topN", key: "reports.top_n", kind: "int", def: 10, min: 1, max: 100 },
    { field: "exportEnabled", key: "reports.export_enabled", kind: "boolean", def: true },
  ],
};

export type ModuleSettings = Record<string, boolean | number>;

// Missing rows mean defaults (PRODUCT §7.3 table).
export async function readModuleSettings(db: Database, module: ModuleName): Promise<ModuleSettings> {
  const specs = MODULE_SPECS[module];
  const rows = await db
    .select({ key: appSetting.key, value: appSetting.value })
    .from(appSetting)
    .where(inArray(appSetting.key, specs.map((spec) => spec.key)));
  const values = new Map(rows.map((row) => [row.key, row.value]));

  const result: ModuleSettings = {};
  for (const spec of specs) {
    const stored = values.get(spec.key);
    result[spec.field] =
      stored === undefined
        ? spec.def
        : spec.kind === "boolean"
          ? stored !== "false"
          : Number.isInteger(Number(stored)) && Number(stored) >= spec.min && Number(stored) <= spec.max
            ? Number(stored)
            : spec.def;
  }
  return result;
}

// Unknown keys and wrong value types are rejected (PRODUCT §7.3 settings rules).
export async function writeModuleSettings(
  db: Database,
  module: ModuleName,
  values: Record<string, unknown>,
  updatedBy: string,
): Promise<ModuleSettings> {
  const specs = MODULE_SPECS[module];
  const specByField = new Map(specs.map((spec) => [spec.field, spec]));

  const unknown = Object.keys(values).filter((field) => !specByField.has(field));
  if (unknown.length > 0) {
    throw new Error(`Unknown setting(s) for ${module}: ${unknown.join(", ")}.`);
  }

  const rows: { key: string; value: string }[] = [];
  for (const [field, value] of Object.entries(values)) {
    const spec = specByField.get(field)!;
    if (spec.kind === "boolean") {
      if (typeof value !== "boolean") {
        throw new Error(`Setting ${spec.key} must be a boolean.`);
      }
      rows.push({ key: spec.key, value: String(value) });
    } else {
      if (typeof value !== "number" || !Number.isInteger(value) || value < spec.min || value > spec.max) {
        throw new Error(`Setting ${spec.key} must be a whole number between ${spec.min} and ${spec.max}.`);
      }
      rows.push({ key: spec.key, value: String(value) });
    }
  }

  for (const row of rows) {
    await db
      .insert(appSetting)
      .values({ ...row, updatedBy })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { value: row.value, updatedBy, updatedAt: new Date() },
      });
  }

  return readModuleSettings(db, module);
}
