import { announcement } from "@Alumni-Network/db/schema/announcement";
import { cohort } from "@Alumni-Network/db/schema/cohort";
import { event } from "@Alumni-Network/db/schema/event";
import type { Database } from "@Alumni-Network/db";
import { TRPCError } from "@trpc/server";
import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";

import { getMyCohort } from "../cohorts-helper";
import { adminProcedure, protectedProcedure, router } from "../index";

const CURRENT_YEAR = new Date().getFullYear();

const socialUrlField = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v.startsWith("https://"), "socialUrl must be an HTTPS URL")
  .optional()
  .nullable();

const cohortFields = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  startYear: z.number().int().min(1950).max(CURRENT_YEAR),
  endYear: z.number().int().min(1950).max(CURRENT_YEAR),
  socialUrl: socialUrlField,
});

async function checkOverlap(db: Database, startYear: number, endYear: number, excludeId?: string) {
  if (endYear < startYear) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "endYear must be >= startYear" });
  }
  const others = await db.select().from(cohort);
  for (const other of others) {
    if (excludeId && other.id === excludeId) continue;
    if (startYear <= other.endYear && endYear >= other.startYear) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Overlaps cohort ${other.name}` });
    }
  }
}

export const cohortsRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(cohort).orderBy(asc(cohort.startYear));
  }),

  create: adminProcedure.input(cohortFields).mutation(async ({ ctx, input }) => {
    await checkOverlap(ctx.db, input.startYear, input.endYear);
    const [row] = await ctx.db
      .insert(cohort)
      .values({
        name: input.name,
        startYear: input.startYear,
        endYear: input.endYear,
        socialUrl: input.socialUrl || null,
        createdBy: ctx.currentUser.id,
      })
      .returning();
    return row;
  }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(2).max(80).optional(),
        startYear: z.number().int().min(1950).max(CURRENT_YEAR).optional(),
        endYear: z.number().int().min(1950).max(CURRENT_YEAR).optional(),
        socialUrl: socialUrlField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(cohort)
        .where(eq(cohort.id, input.id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cohort not found" });

      const merged = {
        name: input.name ?? existing.name,
        startYear: input.startYear ?? existing.startYear,
        endYear: input.endYear ?? existing.endYear,
      };
      await checkOverlap(ctx.db, merged.startYear, merged.endYear, input.id);

      const [row] = await ctx.db
        .update(cohort)
        .set({
          name: merged.name,
          startYear: merged.startYear,
          endYear: merged.endYear,
          socialUrl: input.socialUrl === undefined ? existing.socialUrl : input.socialUrl || null,
          updatedAt: new Date(),
        })
        .where(eq(cohort.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Cohort not found" });
      return row;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: cohort.id })
        .from(cohort)
        .where(eq(cohort.id, input.id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cohort not found" });

      const [a] = await ctx.db
        .select({ value: count() })
        .from(announcement)
        .where(eq(announcement.audience, input.id));
      const [e] = await ctx.db
        .select({ value: count() })
        .from(event)
        .where(eq(event.audience, input.id));
      const usage = (a?.value ?? 0) + (e?.value ?? 0);
      if (usage > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cohort is used by ${usage} announcement(s)/event(s)`,
        });
      }
      await ctx.db.delete(cohort).where(eq(cohort.id, input.id));
      return { deleted: true };
    }),

  getMyCohort: protectedProcedure.query(async ({ ctx }) => {
    const cohortRow = await getMyCohort(ctx.db, ctx.currentUser.id);
    return { cohort: cohortRow };
  }),
});
