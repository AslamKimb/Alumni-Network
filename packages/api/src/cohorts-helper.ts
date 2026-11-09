import { alumniProfile } from "@Alumni-Network/db/schema/auth";
import { cohort } from "@Alumni-Network/db/schema/cohort";
import type { Database } from "@Alumni-Network/db";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte, or } from "drizzle-orm";

export async function getCohortForYear(db: Database, year: number | null | undefined) {
  if (year == null) return null;
  const [row] = await db
    .select()
    .from(cohort)
    .where(and(lte(cohort.startYear, year), gte(cohort.endYear, year)))
    .limit(1);
  return row ?? null;
}

export async function getMyCohort(db: Database, userId: string) {
  const [profile] = await db
    .select({ campusEndYear: alumniProfile.campusEndYear })
    .from(alumniProfile)
    .where(eq(alumniProfile.userId, userId))
    .limit(1);
  return getCohortForYear(db, profile?.campusEndYear);
}

export async function validateAudience(db: Database, audience: string | undefined | null) {
  if (!audience || audience === "all") return;
  const [row] = await db
    .select({ id: cohort.id })
    .from(cohort)
    .where(eq(cohort.id, audience))
    .limit(1);
  if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: "Cohort not found" });
}

type AudienceCol = Parameters<typeof eq>[0];

/** Audience condition: audience="all" OR (my cohort AND audience=my cohort). */
export function audienceCondition(column: AudienceCol, myCohortId: string | null) {
  return myCohortId
    ? or(eq(column, "all"), eq(column, myCohortId))
    : eq(column, "all");
}
