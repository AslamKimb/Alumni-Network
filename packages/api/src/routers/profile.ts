import { alumniProfile, duty, education, user } from "@Alumni-Network/db/schema/auth";
import { appSetting } from "@Alumni-Network/db/schema/setting";
import { PERMISSION_KEYS, parsePermissions } from "@Alumni-Network/auth/permissions";
import type { Database } from "@Alumni-Network/db";
import { TRPCError } from "@trpc/server";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { COUNTRIES } from "../countries";
import { protectedProcedure, router } from "../index";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MIN = 1950;

const year = z
  .number()
  .int()
  .min(YEAR_MIN, `Year must be ${YEAR_MIN} or later`)
  .max(CURRENT_YEAR, `Year must be ${CURRENT_YEAR} or earlier`);

const optionalYear = year.optional().nullable();

const WORK_STATUSES = [
  "employed",
  "self_employed",
  "student",
  "unemployed",
  "retired",
  "other",
] as const;
const DUTY_TYPES = ["religious", "political", "other"] as const;
const EDUCATION_LEVELS = [
  "secondary",
  "certificate",
  "diploma",
  "bachelor",
  "master",
  "doctorate",
  "other",
] as const;
const COUNTRY_CODES = new Set<string>(COUNTRIES.map(({ code }) => code));

const phoneInput = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{7,20}$/, "Enter a valid phone number")
  .optional()
  .nullable();
const regionInput = z.string().trim().max(80).optional().nullable();

const dutyInput = z
  .object({
    type: z.enum(DUTY_TYPES),
    title: z.string().trim().min(1).max(120),
    organization: z.string().trim().min(1).max(120),
    startYear: year,
    endYear: optionalYear,
    description: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.endYear == null || v.endYear >= v.startYear, {
    message: "End year cannot precede start year",
    path: ["endYear"],
  });

const educationInput = z.object({
  level: z.enum(EDUCATION_LEVELS),
  program: z.string().trim().min(1).max(120),
  institution: z.string().trim().min(1).max(120),
  yearCompleted: year,
  description: z.string().trim().max(500).optional().nullable(),
});

const updateProfileInput = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: phoneInput,
    campusStartYear: year,
    campusEndYear: year,
    countryCode: z.string().refine((code) => COUNTRY_CODES.has(code), "Select a valid country"),
    city: z.string().trim().min(2).max(80),
    region: regionInput,
    workStatus: z.enum(WORK_STATUSES),
    professionalTitle: z.string().trim().max(120).optional().nullable(),
    employer: z.string().trim().max(120).optional().nullable(),
    bio: z.string().trim().max(300).optional().nullable(),
    duties: z.array(dutyInput).max(100).default([]),
    education: z.array(educationInput).max(100).default([]),
  })
  .refine((v) => v.campusEndYear >= v.campusStartYear, {
    message: "End year cannot precede start year",
    path: ["campusEndYear"],
  })
  .superRefine((v, ctx) => {
    const needsTitle = v.workStatus === "employed" || v.workStatus === "self_employed";
    const title = v.professionalTitle?.trim() ?? "";
    if (needsTitle && (title.length < 2 || title.length > 120)) {
      ctx.addIssue({
        code: "custom",
        path: ["professionalTitle"],
        message: "Professional title is required (2–120 characters)",
      });
    }
  });

const EDUCATION_RANK: Record<string, number> = {
  doctorate: 6,
  master: 5,
  bachelor: 4,
  diploma: 3,
  certificate: 2,
  secondary: 1,
  other: 0,
};

export type CompletenessInput = {
  fullName?: string | null;
  campusStartYear?: number | null;
  campusEndYear?: number | null;
  countryCode?: string | null;
  city?: string | null;
  workStatus?: string | null;
  professionalTitle?: string | null;
};

// Required-only completeness (§4.2): full name, campus start/end, country,
// city, work status, plus professional title when employed or self-employed.
export function computeCompleteness(profile: CompletenessInput | null | undefined) {
  const missing: string[] = [];
  if (!profile?.fullName?.trim()) missing.push("Full name");
  if (profile?.campusStartYear == null) missing.push("Campus start year");
  if (profile?.campusEndYear == null) missing.push("Campus end year");
  if (!profile?.countryCode?.trim()) missing.push("Country");
  if (!profile?.city?.trim()) missing.push("City");
  if (!profile?.workStatus) missing.push("Work status");
  const needsTitle =
    profile?.workStatus === "employed" || profile?.workStatus === "self_employed";
  if (needsTitle && !profile?.professionalTitle?.trim()) missing.push("Professional title");

  const total = needsTitle ? 7 : 6;
  const percent = Math.round(((total - missing.length) / total) * 100);
  return { percent, missing };
}

export function sortDutiesNewestFirst<T extends { startYear: number }>(duties: T[]) {
  return [...duties].sort((a, b) => b.startYear - a.startYear);
}

export function sortEducationHighestFirst<
  T extends { level: string; yearCompleted: number },
>(entries: T[]) {
  return [...entries].sort(
    (a, b) =>
      (EDUCATION_RANK[b.level] ?? 0) - (EDUCATION_RANK[a.level] ?? 0) ||
      b.yearCompleted - a.yearCompleted,
  );
}

async function findProfile(db: Database, userId: string) {
  const [profile] = await db
    .select()
    .from(alumniProfile)
    .where(eq(alumniProfile.userId, userId))
    .limit(1);
  return profile;
}

async function readProfileSettings(db: Database) {
  const rows = await db
    .select({ key: appSetting.key, value: appSetting.value })
    .from(appSetting)
    .where(inArray(appSetting.key, ["profile.allow_edits", "profile.max_duties", "profile.max_education"]));
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const parseLimit = (raw: string | undefined) => {
    const parsed = Number.parseInt(raw ?? "", 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 10;
  };
  return {
    allowEdits: values.get("profile.allow_edits") !== "false",
    maxDuties: parseLimit(values.get("profile.max_duties")),
    maxEducation: parseLimit(values.get("profile.max_education")),
  };
}

async function getMyProfileData(db: Database, userId: string) {
  const profile = await findProfile(db, userId);
  if (!profile) {
    return {
      profile: null,
      duties: [],
      education: [],
      completeness: computeCompleteness(null),
      onboardingCompleted: false,
    };
  }
  const [duties, entries] = await Promise.all([
    db.select().from(duty).where(eq(duty.profileId, profile.id)).orderBy(asc(duty.sortOrder)),
    db
      .select()
      .from(education)
      .where(eq(education.profileId, profile.id))
      .orderBy(asc(education.sortOrder)),
  ]);
  return {
    profile,
    duties: sortDutiesNewestFirst(duties),
    education: sortEducationHighestFirst(entries),
    completeness: computeCompleteness(profile),
    onboardingCompleted: !!profile.onboardingCompletedAt,
  };
}

const nullIfEmpty = (value: string | null | undefined) =>
  value?.trim() ? value.trim() : null;

export const profileRouter = router({
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    return getMyProfileData(ctx.db, ctx.currentUser.id);
  }),

  getMyPermissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.currentUser.role === "admin") return [...PERMISSION_KEYS];
    return parsePermissions(ctx.currentUser.permissions);
  }),

  updateProfile: protectedProcedure
    .input(updateProfileInput)
    .mutation(async ({ ctx, input }) => {
      const profile = await findProfile(ctx.db, ctx.currentUser.id);
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }

      const settings = await readProfileSettings(ctx.db);
      // Onboarding is never blocked by the edit setting (§4.2, §7.3).
      if (!settings.allowEdits && profile.onboardingCompletedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Profile editing is disabled" });
      }
      if (input.duties.length > settings.maxDuties) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `At most ${settings.maxDuties} duties` });
      }
      if (input.education.length > settings.maxEducation) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `At most ${settings.maxEducation} education entries`,
        });
      }

      const profileId = profile.id;
      const fullName = input.fullName.trim();

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(alumniProfile)
          .set({
            fullName,
            phone: nullIfEmpty(input.phone),
            campusStartYear: input.campusStartYear,
            campusEndYear: input.campusEndYear,
            countryCode: input.countryCode,
            city: input.city.trim(),
            region: nullIfEmpty(input.region),
            workStatus: input.workStatus,
            professionalTitle: nullIfEmpty(input.professionalTitle),
            employer: nullIfEmpty(input.employer),
            bio: nullIfEmpty(input.bio),
            updatedAt: new Date(),
          })
          .where(eq(alumniProfile.id, profileId));

        await tx.update(user).set({ name: fullName }).where(eq(user.id, ctx.currentUser.id));

        await tx.delete(duty).where(eq(duty.profileId, profileId));
        await tx.delete(education).where(eq(education.profileId, profileId));

        if (input.duties.length > 0) {
          await tx.insert(duty).values(
            input.duties.map((entry, index) => ({
              profileId,
              type: entry.type,
              title: entry.title.trim(),
              organization: entry.organization.trim(),
              startYear: entry.startYear,
              endYear: entry.endYear ?? null,
              description: nullIfEmpty(entry.description),
              sortOrder: index,
            })),
          );
        }
        if (input.education.length > 0) {
          await tx.insert(education).values(
            input.education.map((entry, index) => ({
              profileId,
              level: entry.level,
              program: entry.program.trim(),
              institution: entry.institution.trim(),
              yearCompleted: entry.yearCompleted,
              description: nullIfEmpty(entry.description),
              sortOrder: index,
            })),
          );
        }
      });

      return getMyProfileData(ctx.db, ctx.currentUser.id);
    }),
});
