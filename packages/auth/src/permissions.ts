export const PERMISSION_KEYS = [
  "events:manage",
  "records:view",
  "records:export",
  "reports:view",
  "reports:export",
  "settings:manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "events:manage": "Manage events",
  "records:view": "View alumni records",
  "records:export": "Export alumni data",
  "reports:view": "View reports",
  "reports:export": "Export reports",
  "settings:manage": "Manage settings",
};

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "events:manage": "Create, publish, and delete events and updates.",
  "records:view": "View alumnus records, including deactivation controls.",
  "records:export": "Download alumni records as a CSV file.",
  "reports:view": "View aggregated alumni reports and charts.",
  "reports:export": "Download report data as CSV files.",
  "settings:manage": "Change organization and module settings.",
};

const PERMISSION_SET = new Set<string>(PERMISSION_KEYS);

type PermissionUser = {
  role?: string | null;
  permissions?: string | string[] | null;
};

/**
 * Parse a stored permissions JSON string into validated, deduped keys.
 * Unknown keys are dropped; missing or malformed input yields an empty array.
 */
export function parsePermissions(jsonText: unknown): string[] {
  if (Array.isArray(jsonText)) return validateList(jsonText);
  if (typeof jsonText !== "string" || !jsonText.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(jsonText);
    return Array.isArray(parsed) ? validateList(parsed) : [];
  } catch {
    return [];
  }
}

function validateList(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || !PERMISSION_SET.has(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

/**
 * Full admins hold every permission implicitly; other roles follow their
 * per-account permission list.
 */
export function hasPermission(user: PermissionUser, key: string): boolean {
  if (user.role === "admin") return true;
  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : parsePermissions(user.permissions ?? "[]");
  return permissions.includes(key);
}
