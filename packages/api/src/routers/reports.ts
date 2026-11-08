import { alumniProfile, duty, education, user } from "@Alumni-Network/db/schema/auth";
import { appSetting } from "@Alumni-Network/db/schema/setting";
import type { Database } from "@Alumni-Network/db";
import { readModuleSettings, readOrganizationSettings } from "@Alumni-Network/db/settings";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { COUNTRIES } from "../countries";
import { permissionProcedure, router } from "../index";

// Settings keys (PRODUCT §7.3). Missing rows mean defaults: enabled on.
const EXPORT_ENABLED_KEY = "reports.export_enabled";
const INCLUDE_PHONE_KEY = "records.include_phone_in_export";

const COUNTRY_NAMES: Map<string, string> = new Map(COUNTRIES.map((c) => [c.code, c.name]));

const workStatuses = ["employed", "self_employed", "student", "unemployed", "retired", "other"] as const;
const dutyTypes = ["religious", "political", "other"] as const;
const educationLevels = [
  "secondary",
  "certificate",
  "diploma",
  "bachelor",
  "master",
  "doctorate",
  "other",
] as const;

const filtersInput = z.object({
  campusFrom: z.number().int().min(1950).max(2100).optional().nullable(),
  campusTo: z.number().int().min(1950).max(2100).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
  workStatus: z.enum(workStatuses).optional().nullable(),
  educationLevel: z.enum(educationLevels).optional().nullable(),
  dutyType: z.enum(dutyTypes).optional().nullable(),
});

type Filters = z.infer<typeof filtersInput>;

const EDUCATION_RANK: Record<string, number> = {
  secondary: 1,
  certificate: 2,
  diploma: 3,
  bachelor: 4,
  master: 5,
  doctorate: 6,
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const pct = (count: number, total: number) => (total === 0 ? 0 : round1((count / total) * 100));

async function readReportsSettings(db: Database) {
  const [moduleSettings, rows] = await Promise.all([
    readModuleSettings(db, "reports").catch(() => null),
    db
      .select({ key: appSetting.key, value: appSetting.value })
      .from(appSetting)
      .where(inArray(appSetting.key, [EXPORT_ENABLED_KEY, INCLUDE_PHONE_KEY])),
  ]);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    moduleEnabled: (moduleSettings?.moduleEnabled as boolean | undefined) !== false,
    exportEnabled:
      moduleSettings?.exportEnabled !== undefined
        ? (moduleSettings.exportEnabled as boolean)
        : values.get(EXPORT_ENABLED_KEY) !== "false",
    topN: typeof moduleSettings?.topN === "number" ? (moduleSettings.topN as number) : 10,
    includePhone: values.get(INCLUDE_PHONE_KEY) === "true",
  };
}

// All filters combine with AND (same overlap rule as alumni list). Deactivated
// accounts are always excluded from reports (PRODUCT §8.2).
function buildWhere(filters: Filters) {
  const conditions = [isNull(user.deactivatedAt)];
  if (filters.country) conditions.push(eq(alumniProfile.countryCode, filters.country));
  if (filters.campusFrom != null) conditions.push(gte(alumniProfile.campusEndYear, filters.campusFrom));
  if (filters.campusTo != null) conditions.push(lte(alumniProfile.campusStartYear, filters.campusTo));
  if (filters.workStatus) conditions.push(eq(alumniProfile.workStatus, filters.workStatus));
  if (filters.educationLevel) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${education} WHERE ${education.profileId} = ${alumniProfile.id} AND ${education.level} = ${filters.educationLevel})`,
    );
  }
  if (filters.dutyType) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${duty} WHERE ${duty.profileId} = ${alumniProfile.id} AND ${duty.type} = ${filters.dutyType})`,
    );
  }
  return and(...conditions);
}

// Required-only completeness (§4.2): full name, campus start/end, country,
// city, work status, plus professional title when employed or self-employed.
function isComplete(row: {
  fullName: string | null;
  campusStartYear: number | null;
  campusEndYear: number | null;
  countryCode: string | null;
  city: string | null;
  workStatus: string | null;
  professionalTitle: string | null;
}) {
  if (!row.fullName?.trim()) return false;
  if (row.campusStartYear == null || row.campusEndYear == null) return false;
  if (!row.countryCode?.trim() || !row.city?.trim() || !row.workStatus) return false;
  const needsTitle = row.workStatus === "employed" || row.workStatus === "self_employed";
  return !needsTitle || !!row.professionalTitle?.trim();
}

// RFC 4180 quoting + formula-injection guard (same as alumni CSV).
function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

const toISODate = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value ? new Date(value as string).toISOString().slice(0, 10) : "";

const todayFileDate = () => new Date().toISOString().slice(0, 10);

async function fetchFiltered(db: Database, filters: Filters) {
  const where = buildWhere(filters);
  const rows = await db
    .select({
      id: alumniProfile.id,
      userId: alumniProfile.userId,
      fullName: alumniProfile.fullName,
      phone: alumniProfile.phone,
      campusStartYear: alumniProfile.campusStartYear,
      campusEndYear: alumniProfile.campusEndYear,
      city: alumniProfile.city,
      region: alumniProfile.region,
      countryCode: alumniProfile.countryCode,
      workStatus: alumniProfile.workStatus,
      professionalTitle: alumniProfile.professionalTitle,
      employer: alumniProfile.employer,
      bio: alumniProfile.bio,
      email: user.email,
      createdAt: alumniProfile.createdAt,
      updatedAt: alumniProfile.updatedAt,
    })
    .from(alumniProfile)
    .innerJoin(user, eq(user.id, alumniProfile.userId))
    .where(where)
    .orderBy(desc(alumniProfile.updatedAt), asc(alumniProfile.fullName));

  const profileIds = rows.map((row) => row.id);
  const [allDuties, allEducation] = profileIds.length
    ? await Promise.all([
        db.select().from(duty).where(inArray(duty.profileId, profileIds)).orderBy(asc(duty.sortOrder)),
        db.select().from(education).where(inArray(education.profileId, profileIds)).orderBy(asc(education.sortOrder)),
      ])
    : [[], []];
  return { rows, duties: allDuties, education: allEducation };
}

function topNWithOther(entries: { label: string; count: number }[], n: number) {
  const sorted = [...entries].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (sorted.length <= n) return sorted;
  const head = sorted.slice(0, n);
  const other = sorted.slice(n).reduce((acc, entry) => acc + entry.count, 0);
  return other > 0 ? [...head, { label: "Other", count: other }] : head;
}

function buildReport(
  rows: Awaited<ReturnType<typeof fetchFiltered>>["rows"],
  duties: Awaited<ReturnType<typeof fetchFiltered>>["duties"],
  educationRows: Awaited<ReturnType<typeof fetchFiltered>>["education"],
  homeCountry: string,
  topN: number,
) {
  const total = rows.length;
  const completeCount = rows.filter(isComplete).length;
  const employedCount = rows.filter((r) => r.workStatus === "employed" || r.workStatus === "self_employed").length;
  const abroadCount = homeCountry ? rows.filter((r) => r.countryCode && r.countryCode !== homeCountry).length : 0;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const new30d = rows.filter((r) => new Date(r.createdAt as Date).getTime() >= cutoff).length;

  const countBy = (key: (row: (typeof rows)[number]) => string | null | number) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const value = key(row);
      const label = value == null || String(value).trim() === "" ? "Not recorded" : String(value);
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, count]) => ({ label, count }));
  };

  const country = topNWithOther(
    countBy((r) => r.countryCode?.trim() && COUNTRY_NAMES.get(r.countryCode) ? COUNTRY_NAMES.get(r.countryCode)! : r.countryCode),
    topN,
  );
  const city = topNWithOther(countBy((r) => r.city), topN);
  const campusYear = countBy((r) => r.campusEndYear).sort((a, b) => {
    if (a.label === "Not recorded") return 1;
    if (b.label === "Not recorded") return -1;
    return Number(a.label) - Number(b.label);
  });
  const workStatus = countBy((r) => r.workStatus).sort((a, b) => b.count - a.count);
  const topTitles = topNWithOther(
    countBy((r) => (r.professionalTitle?.trim() ? r.professionalTitle : null)).filter((e) => e.label !== "Not recorded"),
    topN,
  );

  // Highest education per alumnus (secondary 1 .. doctorate 6; 'other' excluded).
  const educationByProfile = new Map<string, string[]>();
  for (const entry of educationRows) {
    const list = educationByProfile.get(entry.profileId) ?? [];
    list.push(entry.level);
    educationByProfile.set(entry.profileId, list);
  }
  const educationCounts = new Map<string, number>();
  for (const row of rows) {
    let best = 0;
    let bestLevel = "Not recorded";
    for (const level of educationByProfile.get(row.id) ?? []) {
      const rank = EDUCATION_RANK[level] ?? 0;
      if (rank > best) {
        best = rank;
        bestLevel = level;
      }
    }
    educationCounts.set(bestLevel, (educationCounts.get(bestLevel) ?? 0) + 1);
  }
  const educationOrder = ["secondary", "certificate", "diploma", "bachelor", "master", "doctorate"];
  const education = [
    ...educationOrder
      .filter((level) => (educationCounts.get(level) ?? 0) > 0)
      .map((level) => ({ label: level, count: educationCounts.get(level)! })),
    ...((educationCounts.get("Not recorded") ?? 0) > 0
      ? [{ label: "Not recorded", count: educationCounts.get("Not recorded")! }]
      : []),
  ];

  // Duty participation: distinct alumni per type (an alumnus can count twice).
  const dutyByProfile = new Map<string, Set<string>>();
  for (const entry of duties) {
    const set = dutyByProfile.get(entry.profileId) ?? new Set<string>();
    set.add(entry.type);
    dutyByProfile.set(entry.profileId, set);
  }
  const dutyParticipation = {
    religious: [...dutyByProfile.values()].filter((s) => s.has("religious")).length,
    political: [...dutyByProfile.values()].filter((s) => s.has("political")).length,
    other: [...dutyByProfile.values()].filter((s) => s.has("other")).length,
  };

  return {
    total,
    complete: pct(completeCount, total),
    employedPct: pct(employedCount, total),
    abroadPct: homeCountry ? pct(abroadCount, total) : null,
    new30d,
    country,
    city,
    campusYear,
    workStatus,
    education,
    topTitles,
    dutyParticipation,
  };
}

const aggregatesCsv = (report: ReturnType<typeof buildReport>) => {
  const lines: (string | number)[][] = [["Metric", "Dimension", "Count", "Percentage"]];
  const total = report.total;
  const addGroup = (metric: string, entries: { label: string; count: number }[]) => {
    for (const entry of entries) lines.push([metric, entry.label, entry.count, pct(entry.count, total).toFixed(1)]);
  };
  addGroup("Country", report.country);
  addGroup("City", report.city);
  addGroup("Campus year", report.campusYear);
  addGroup("Work status", report.workStatus);
  addGroup("Education", report.education);
  addGroup("Top professional titles", report.topTitles);
  addGroup("Duty participation", [
    { label: "religious", count: report.dutyParticipation.religious },
    { label: "political", count: report.dutyParticipation.political },
    { label: "other", count: report.dutyParticipation.other },
  ]);
  const csv = `\uFEFF${lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n")}\r\n`;
  return { csv, rowCount: lines.length - 1 };
};

async function requireReportsModule(db: Database) {
  const settings = await readReportsSettings(db);
  if (!settings.moduleEnabled) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Reports are not available" });
  }
  return settings;
}

export const reportsRouter = router({
  getReport: permissionProcedure("reports:view").input(filtersInput).query(async ({ ctx, input }) => {
    const settings = await requireReportsModule(ctx.db);
    const [organization, filtered] = await Promise.all([
      readOrganizationSettings(ctx.db).catch(() => null),
      fetchFiltered(ctx.db, input),
    ]);
    const report = buildReport(
      filtered.rows,
      filtered.duties,
      filtered.education,
      (organization?.homeCountry ?? "").trim(),
      settings.topN,
    );

    return {
      kpis: {
        total: report.total,
        complete: report.complete,
        employedPct: report.employedPct,
        abroadPct: report.abroadPct,
        new30d: report.new30d,
      },
      charts: {
        country: report.country,
        city: report.city,
        campusYear: report.campusYear,
        workStatus: report.workStatus,
        education: report.education,
        topTitles: report.topTitles,
        dutyParticipation: report.dutyParticipation,
      },
      preview: filtered.rows.slice(0, 10).map((row) => ({
        id: row.id,
        fullName: row.fullName,
        campusStartYear: row.campusStartYear,
        campusEndYear: row.campusEndYear,
        city: row.city,
        countryCode: row.countryCode,
        countryName: row.countryCode ? (COUNTRY_NAMES.get(row.countryCode) ?? null) : null,
        workStatus: row.workStatus,
        professionalTitle: row.professionalTitle,
        updatedAt: row.updatedAt,
      })),
      filters: {
        campusFrom: input.campusFrom ?? null,
        campusTo: input.campusTo ?? null,
        country: input.country ?? null,
        workStatus: input.workStatus ?? null,
        educationLevel: input.educationLevel ?? null,
        dutyType: input.dutyType ?? null,
      },
      exportEnabled: settings.exportEnabled,
    };
  }),

  exportRecordsCSV: permissionProcedure("reports:export").input(filtersInput).query(async ({ ctx, input }) => {
    const settings = await requireReportsModule(ctx.db);
    if (!settings.exportEnabled) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Reports export is disabled" });
    }
    const filtered = await fetchFiltered(ctx.db, input);
    const { rows, duties, education: educationRows } = filtered;

    const dutiesByProfile = new Map<string, typeof duties>();
    for (const d of duties) {
      const list = dutiesByProfile.get(d.profileId) ?? [];
      list.push(d);
      dutiesByProfile.set(d.profileId, list);
    }
    const educationByProfile = new Map<string, typeof educationRows>();
    for (const e of educationRows) {
      const list = educationByProfile.get(e.profileId) ?? [];
      list.push(e);
      educationByProfile.set(e.profileId, list);
    }

    const headers = [
      "Full name",
      "Email",
      ...(settings.includePhone ? ["Phone"] : []),
      "Campus start",
      "Campus end",
      "City",
      "Region",
      "Country",
      "Work status",
      "Professional title",
      "Employer",
      "Bio",
      "Duties",
      "Education",
      "Signed up",
      "Updated",
    ];

    const lines = rows.map((row) => {
      const dutiesCell = (dutiesByProfile.get(row.id) ?? [])
        .map((d) => `${d.type}: ${d.title}, ${d.organization} (${d.startYear}–${d.endYear ?? "present"})`)
        .join("; ");
      const educationCell = (educationByProfile.get(row.id) ?? [])
        .map((e) => `${e.level}: ${e.program}, ${e.institution} (${e.yearCompleted})`)
        .join("; ");
      return [
        row.fullName,
        row.email,
        ...(settings.includePhone ? [row.phone ?? ""] : []),
        row.campusStartYear ?? "",
        row.campusEndYear ?? "",
        row.city ?? "",
        row.region ?? "",
        row.countryCode ? (COUNTRY_NAMES.get(row.countryCode) ?? row.countryCode) : "",
        row.workStatus ?? "",
        row.professionalTitle ?? "",
        row.employer ?? "",
        row.bio ?? "",
        dutiesCell,
        educationCell,
        toISODate(row.createdAt),
        toISODate(row.updatedAt),
      ];
    });

    const csv = `\uFEFF${headers.map(csvCell).join(",")}\r\n${lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n")}\r\n`;
    return { filename: `alumni-records-${todayFileDate()}.csv`, csv, rowCount: lines.length };
  }),

  exportAggregatesCSV: permissionProcedure("reports:export").input(filtersInput).query(async ({ ctx, input }) => {
    const settings = await requireReportsModule(ctx.db);
    if (!settings.exportEnabled) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Reports export is disabled" });
    }
    const [organization, filtered] = await Promise.all([
      readOrganizationSettings(ctx.db).catch(() => null),
      fetchFiltered(ctx.db, input),
    ]);
    const report = buildReport(
      filtered.rows,
      filtered.duties,
      filtered.education,
      (organization?.homeCountry ?? "").trim(),
      settings.topN,
    );
    const { csv, rowCount } = aggregatesCsv(report);
    return { filename: `alumni-aggregates-${todayFileDate()}.csv`, csv, rowCount };
  }),
});
