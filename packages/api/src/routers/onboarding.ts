import { alumniProfile, duty, education, user } from "@Alumni-Network/db/schema/auth";
import type { Database } from "@Alumni-Network/db";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNotNull } from "drizzle-orm";
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
const fullNameInput = z.string().trim().min(2).max(120);

const step1Input = z
  .object({
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ]{7,20}$/, "Enter a valid phone number")
      .optional()
      .nullable(),
    campusStartYear: year,
    campusEndYear: year,
  })
  .refine((v) => v.campusEndYear >= v.campusStartYear, {
    message: "End year cannot precede start year",
    path: ["campusEndYear"],
  });

const step2Input = z
  .object({
    countryCode: z.string().refine((code) => COUNTRY_CODES.has(code), "Select a valid country"),
    city: z.string().trim().min(2).max(80),
    region: z.string().trim().min(2).max(80).optional().nullable(),
    workStatus: z.enum(WORK_STATUSES),
    professionalTitle: z.string().trim().max(120).optional().nullable(),
    employer: z.string().trim().max(120).optional().nullable(),
    bio: z.string().trim().max(300).optional().nullable(),
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

const step3Input = z.object({
  duties: z.array(dutyInput).max(10).default([]),
  education: z.array(educationInput).max(10).default([]),
});

type Profile = typeof alumniProfile.$inferSelect;

// Every distinct value must come from someone else's record, so the cap keeps
// the payload small enough to send with the step-2 form.
const SUGGESTION_LIMIT = 500;

function firstIncompleteStep(profile: Profile | undefined) {
  if (profile?.onboardingCompletedAt) return null;
  if (!profile?.campusStartYear || !profile.campusEndYear) return 1;
  if (!profile.countryCode || !profile.city || !profile.workStatus) return 2;
  return 3;
}

async function findProfile(db: Database, userId: string) {
  const [profile] = await db
    .select()
    .from(alumniProfile)
    .where(eq(alumniProfile.userId, userId))
    .limit(1);
  return profile;
}

async function requireProfile(db: Database, userId: string) {
  const profile = await findProfile(db, userId);
  if (!profile) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Consent is required before onboarding.",
    });
  }
  return profile;
}

export const onboardingRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const profile = await findProfile(ctx.db, ctx.currentUser.id);

    if (!profile) {
      return {
        needsConsent: true,
        completed: false,
        step: 1,
        profile: null,
        duties: [],
        education: [],
      };
    }

    const [duties, entries] = await Promise.all([
      ctx.db
        .select()
        .from(duty)
        .where(eq(duty.profileId, profile.id))
        .orderBy(asc(duty.sortOrder)),
      ctx.db
        .select()
        .from(education)
        .where(eq(education.profileId, profile.id))
        .orderBy(asc(education.sortOrder)),
    ]);

    return {
      needsConsent: false,
      completed: !!profile.onboardingCompletedAt,
      step: firstIncompleteStep(profile),
      profile: {
        fullName: profile.fullName,
        phone: profile.phone,
        campusStartYear: profile.campusStartYear,
        campusEndYear: profile.campusEndYear,
        countryCode: profile.countryCode,
        city: profile.city,
        region: profile.region,
        workStatus: profile.workStatus,
        professionalTitle: profile.professionalTitle,
        employer: profile.employer,
        bio: profile.bio,
      },
      duties,
      education: entries,
    };
  }),

  // Legacy account: consent must be explicit, so no profile is inferred from
  // sign-up alone. Safe to call repeatedly.
  acceptConsent: protectedProcedure
    .input(z.object({ consent: z.literal(true), fullName: fullNameInput }))
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.transaction(async (tx) => {
        const inserted = await tx
          .insert(alumniProfile)
          .values({
            userId: ctx.currentUser.id,
            fullName: input.fullName,
            consentAt: new Date(),
          })
          .onConflictDoNothing({ target: alumniProfile.userId })
          .returning({ id: alumniProfile.id });
        if (inserted.length === 0) return false;

        await tx
          .update(user)
          .set({ name: input.fullName })
          .where(eq(user.id, ctx.currentUser.id));
        return true;
      });

      return { created };
    }),

  // Values other alumni already typed, so location and work fields can offer
  // what exists instead of asking people to spell it differently each time.
  suggestions: protectedProcedure.query(async ({ ctx }) => {
    const [places, titles, employers] = await Promise.all([
      ctx.db
        .selectDistinct({ city: alumniProfile.city, region: alumniProfile.region })
        .from(alumniProfile)
        .where(isNotNull(alumniProfile.city))
        .orderBy(asc(alumniProfile.city))
        .limit(SUGGESTION_LIMIT),
      ctx.db
        .selectDistinct({ value: alumniProfile.professionalTitle })
        .from(alumniProfile)
        .where(isNotNull(alumniProfile.professionalTitle))
        .orderBy(asc(alumniProfile.professionalTitle))
        .limit(SUGGESTION_LIMIT),
      ctx.db
        .selectDistinct({ value: alumniProfile.employer })
        .from(alumniProfile)
        .where(isNotNull(alumniProfile.employer))
        .orderBy(asc(alumniProfile.employer))
        .limit(SUGGESTION_LIMIT),
    ]);

    const cities = new Set<string>();
    const regions = new Set<string>();
    const cityRegions: { city: string; region: string }[] = [];

    for (const place of places) {
      if (!place.city) continue;
      cities.add(place.city);
      if (!place.region) continue;
      regions.add(place.region);
      cityRegions.push({ city: place.city, region: place.region });
    }

    return {
      cities: [...cities],
      regions: [...regions],
      cityRegions,
      professionalTitles: titles.flatMap((row) => (row.value ? [row.value] : [])),
      employers: employers.flatMap((row) => (row.value ? [row.value] : [])),
    };
  }),

  saveStep1: protectedProcedure.input(step1Input).mutation(async ({ ctx, input }) => {
    const profile = await requireProfile(ctx.db, ctx.currentUser.id);

    await ctx.db
      .update(alumniProfile)
      .set({
        phone: input.phone ?? null,
        campusStartYear: input.campusStartYear,
        campusEndYear: input.campusEndYear,
        updatedAt: new Date(),
      })
      .where(and(eq(alumniProfile.id, profile.id), eq(alumniProfile.userId, ctx.currentUser.id)));
  }),

  saveStep2: protectedProcedure.input(step2Input).mutation(async ({ ctx, input }) => {
    const profile = await requireProfile(ctx.db, ctx.currentUser.id);

    await ctx.db
      .update(alumniProfile)
      .set({
        countryCode: input.countryCode,
        city: input.city,
        region: input.region ?? null,
        workStatus: input.workStatus,
        professionalTitle: input.professionalTitle ?? null,
        employer: input.employer ?? null,
        bio: input.bio ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(alumniProfile.id, profile.id), eq(alumniProfile.userId, ctx.currentUser.id)));
  }),

  saveStep3: protectedProcedure.input(step3Input).mutation(async ({ ctx, input }) => {
    const profile = await requireProfile(ctx.db, ctx.currentUser.id);

    const needsTitle =
      profile.workStatus === "employed" || profile.workStatus === "self_employed";
    if (
      !profile.campusStartYear ||
      !profile.campusEndYear ||
      !profile.countryCode ||
      !profile.city ||
      !profile.workStatus ||
      (needsTitle && !profile.professionalTitle)
    ) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Finish the earlier steps before completing onboarding.",
      });
    }

    const profileId = profile.id;

    // Replace the whole set atomically: a failed write must not erase saved entries.
    await ctx.db.transaction(async (tx) => {
      await tx.delete(duty).where(eq(duty.profileId, profileId));
      await tx.delete(education).where(eq(education.profileId, profileId));

      if (input.duties.length > 0) {
        await tx.insert(duty).values(
          input.duties.map((entry, index) => ({
            profileId,
            type: entry.type,
            title: entry.title,
            organization: entry.organization,
            startYear: entry.startYear,
            endYear: entry.endYear ?? null,
            description: entry.description ?? null,
            sortOrder: index,
          })),
        );
      }

      if (input.education.length > 0) {
        await tx.insert(education).values(
          input.education.map((entry, index) => ({
            profileId,
            level: entry.level,
            program: entry.program,
            institution: entry.institution,
            yearCompleted: entry.yearCompleted,
            description: entry.description ?? null,
            sortOrder: index,
          })),
        );
      }

      await tx
        .update(alumniProfile)
        .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(alumniProfile.id, profileId), eq(alumniProfile.userId, ctx.currentUser.id)));
    });
  }),
});
