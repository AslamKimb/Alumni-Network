import { appSetting } from "@Alumni-Network/db/schema/setting";
import { event } from "@Alumni-Network/db/schema/event";
import { announcement } from "@Alumni-Network/db/schema/announcement";
import type { Database } from "@Alumni-Network/db";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, like, lte, or } from "drizzle-orm";
import { z } from "zod";

import { audienceCondition, getMyCohort, validateAudience } from "../cohorts-helper";
import { permissionProcedure, protectedProcedure, router } from "../index";

const CATEGORIES = ["event", "update"] as const;
const STATUSES = ["draft", "published"] as const;

const httpsUrl = (value: string | null | undefined) =>
  value == null ||
  value === "" ||
  (value.startsWith("https://") && (() => {
    try {
      const url = new URL(value);
      return url.protocol === "https:";
    } catch {
      return false;
    }
  })());

// Drafts may lack summary/body/start; publishing requires all of title, summary,
// body, and starts_at. Non-draft fields are validated here on every write.
const eventFields = (forPublish: boolean) =>
  z.object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(140, "Title must be 140 characters or fewer"),
    summary: forPublish
      ? z.string().trim().min(1, "Summary is required to publish").max(160)
      : z.string().max(160).optional().nullable(),
    body: forPublish
      ? z.string().trim().min(1, "Body is required to publish").max(20000)
      : z.string().max(20000).optional().nullable(),
    category: z.enum(CATEGORIES),
    startsAt: forPublish
      ? z.date({ error: "Start date is required to publish" })
      : z.date().optional().nullable(),
    endsAt: z.date().optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    isOnline: z.boolean().default(false),
    coverImageUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => httpsUrl(v), "Cover image must be an HTTPS URL")
      .optional()
      .nullable(),
    relatedAnnouncementId: z.string().trim().min(1).optional().nullable(),
    audience: z.string().default("all"),
  });

const shape = (input: {
  endsAt?: Date | null;
  startsAt?: Date | null;
  coverImageUrl?: string | null;
}) => {
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "End date cannot precede start date",
    });
  }
  if (input.coverImageUrl && !httpsUrl(input.coverImageUrl)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cover image must be an HTTPS URL",
    });
  }
};

const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const isValidDateKey = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y = 0, m = 0, d = 0] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const parseExceptions = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
function occurrenceDates(startsAt: Date, freq: string, interval: number, end: Date): Date[] {
  const dates: Date[] = [];
  let cur = new Date(startsAt);
  let guard = 0;
  while (cur.getTime() <= end.getTime() && guard++ < 10000) {
    dates.push(new Date(cur));
    if (dates.length >= 101) break;
    const next = new Date(cur);
    if (freq === "daily") next.setDate(next.getDate() + interval);
    else if (freq === "weekly") next.setDate(next.getDate() + interval * 7);
    else next.setMonth(next.getMonth() + interval);
    if (next.getTime() <= cur.getTime()) break;
    cur = next;
  }
  return dates;
}

async function requireAnnouncementExists(
  db: Database,
  relatedAnnouncementId: string | null | undefined,
) {
  if (relatedAnnouncementId == null) return;
  const [row] = await db
    .select({ id: announcement.id })
    .from(announcement)
    .where(eq(announcement.id, relatedAnnouncementId))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });
}

async function requirePublishable(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(event)
    .where(eq(event.id, id))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

  const missing: string[] = [];
  if (!row.title.trim()) missing.push("title");
  if (!row.summary.trim()) missing.push("summary");
  if (!row.body.trim()) missing.push("body");
  if (!row.startsAt) missing.push("start date");
  if (missing.length > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Cannot publish: missing ${missing.join(", ")}`,
    });
  }
  return row;
}

// `events.module_enabled` / `events.show_past_events` (PRODUCT §7.3). No shared
// helper exists for event settings yet, so read `app_setting` directly with
// defaults of true when the row is absent.
async function readEventSettings(db: Database) {
  const rows = await db
    .select({ key: appSetting.key, value: appSetting.value })
    .from(appSetting)
    .where(inArray(appSetting.key, ["events.module_enabled", "events.show_past_events"]));
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    moduleEnabled: values.get("events.module_enabled") !== "false",
    showPastEvents: values.get("events.show_past_events") !== "false",
  };
}

const listAdminInput = z.object({
  search: z.string().trim().max(200).optional().nullable(),
  status: z.enum(STATUSES).optional().nullable(),
  category: z.enum(CATEGORIES).optional().nullable(),
});

export const eventsRouter = router({
  listAdmin: permissionProcedure("events:manage").input(listAdminInput).query(async ({ ctx, input }) => {
    const conditions = [];
    if (input.search) {
      conditions.push(
        or(like(event.title, `%${input.search}%`), like(event.summary, `%${input.search}%`)),
      );
    }
    if (input.status) conditions.push(eq(event.status, input.status));
    if (input.category) conditions.push(eq(event.category, input.category));

    return ctx.db
      .select()
      .from(event)
      .where(and(...conditions))
      .orderBy(desc(event.createdAt));
  }),

  create: permissionProcedure("events:manage").input(eventFields(false)).mutation(async ({ ctx, input }) => {
    shape(input);
    await validateAudience(ctx.db, input.audience);
    await requireAnnouncementExists(ctx.db, input.relatedAnnouncementId);
    const [row] = await ctx.db
      .insert(event)
      .values({
        title: input.title,
        summary: input.summary ?? "",
        body: input.body ?? "",
        category: input.category,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        location: input.location ?? null,
        isOnline: input.isOnline,
        coverImageUrl: input.coverImageUrl || null,
        relatedAnnouncementId: input.relatedAnnouncementId ?? null,
        status: "draft",
        audience: input.audience,
        createdBy: ctx.currentUser.id,
      })
      .returning();
    return row;
  }),

  update: permissionProcedure("events:manage")
    .input(z.object({ id: z.string(), ...eventFields(false).shape }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      // Fetch first so published rows can be re-validated against the
      // publish invariants (§4.4/§9.1) before any write.
      const [existing] = await ctx.db
        .select()
        .from(event)
        .where(eq(event.id, id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

      await validateAudience(ctx.db, values.audience);
      await requireAnnouncementExists(ctx.db, values.relatedAnnouncementId);
      const merged = {
        title: values.title,
        summary: values.summary === undefined ? existing.summary : (values.summary ?? ""),
        body: values.body === undefined ? existing.body : (values.body ?? ""),
        category: values.category,
        startsAt: values.startsAt === undefined ? existing.startsAt : (values.startsAt ?? null),
        endsAt: values.endsAt === undefined ? existing.endsAt : (values.endsAt ?? null),
        location: values.location === undefined ? existing.location : (values.location ?? null),
        isOnline: values.isOnline,
        audience: values.audience,
        coverImageUrl:
          values.coverImageUrl === undefined
            ? existing.coverImageUrl
            : (values.coverImageUrl || null),
        relatedAnnouncementId:
          values.relatedAnnouncementId === undefined
            ? existing.relatedAnnouncementId
            : (values.relatedAnnouncementId ?? null),
      };

      if (existing.status === "published") {
        const missing: string[] = [];
        if (!merged.title.trim() || merged.title.trim().length < 3 || merged.title.length > 140) {
          missing.push("title");
        }
        if (!merged.summary || !merged.summary.trim() || merged.summary.length > 160) {
          missing.push("summary");
        }
        if (!merged.body || !merged.body.trim() || merged.body.length > 20000) {
          missing.push("body");
        }
        if (!merged.startsAt) missing.push("start date");
        if (missing.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot save published event: invalid or missing ${missing.join(", ")}`,
          });
        }
      }
      shape(merged);
      const [row] = await ctx.db
        .update(event)
        .set({
          title: merged.title,
          summary: merged.summary,
          body: merged.body,
          category: merged.category,
          startsAt: merged.startsAt,
          endsAt: merged.endsAt,
          location: merged.location,
          isOnline: merged.isOnline,
          audience: merged.audience,
          coverImageUrl: merged.coverImageUrl,
          relatedAnnouncementId: merged.relatedAnnouncementId,
          updatedAt: new Date(),
        })
        .where(eq(event.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      return row;
    }),

  publish: permissionProcedure("events:manage")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePublishable(ctx.db, input.id);
      const [row] = await ctx.db
        .update(event)
        .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(event.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      return row;
    }),

  unpublish: permissionProcedure("events:manage")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(event)
        .set({ status: "draft", publishedAt: null, updatedAt: new Date() })
        .where(eq(event.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      return row;
    }),

  delete: permissionProcedure("events:manage")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .delete(event)
        .where(eq(event.id, input.id))
        .returning({ id: event.id });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      return { deleted: true };
    }),

  getById: permissionProcedure("events:manage")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(event)
        .where(eq(event.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      return row;
    }),

  listPublished: protectedProcedure.query(async ({ ctx }) => {
    const { moduleEnabled, showPastEvents } = await readEventSettings(ctx.db);
    if (!moduleEnabled) return { upcoming: [], past: [], showPastEvents };

    const myCohort = await getMyCohort(ctx.db, ctx.currentUser.id);
    const now = new Date();
    const base = and(
      eq(event.status, "published"),
      audienceCondition(event.audience, myCohort?.id ?? null),
    );

    const upcoming = await ctx.db
      .select()
      .from(event)
      .where(and(base, gte(event.startsAt, now)))
      .orderBy(asc(event.startsAt));

    const past = showPastEvents
      ? await ctx.db
          .select()
          .from(event)
          .where(and(base, lte(event.startsAt, now)))
          .orderBy(desc(event.startsAt))
      : [];

    return { upcoming, past, showPastEvents };
  }),

  getPublishedById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { moduleEnabled } = await readEventSettings(ctx.db);
      if (!moduleEnabled) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }
      const myCohort = await getMyCohort(ctx.db, ctx.currentUser.id);
      const [row] = await ctx.db
        .select()
        .from(event)
        .where(
          and(
            eq(event.id, input.id),
            eq(event.status, "published"),
            audienceCondition(event.audience, myCohort?.id ?? null),
          ),
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      return row;
    }),

  createSeries: permissionProcedure("events:manage")
    .input(
      z.object({
        ...eventFields(false).shape,
        recurrenceFreq: z.enum(["daily", "weekly", "monthly"]),
        recurrenceInterval: z.number().int().min(1).max(52),
        recurrenceEnd: z.date(),
        exceptionDates: z
          .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
          .max(100)
          .default([])
          .refine((arr) => arr.every(isValidDateKey), {
            message: "exceptionDates must be valid yyyy-mm-dd dates",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      shape(input);
      await validateAudience(ctx.db, input.audience);
      await requireAnnouncementExists(ctx.db, input.relatedAnnouncementId);
      if (!input.startsAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Start date is required for series" });
      }
      if (input.recurrenceEnd.getTime() < input.startsAt.getTime()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "recurrenceEnd cannot precede start date",
        });
      }
      const exceptionSet = new Set(input.exceptionDates);
      const allDates = occurrenceDates(
        input.startsAt,
        input.recurrenceFreq,
        input.recurrenceInterval,
        input.recurrenceEnd,
      );
      const dates = allDates.filter((d) => !exceptionSet.has(dateKey(d)));
      if (dates.length > 100) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Series exceeds 100 instances",
        });
      }
      const [root] = await ctx.db
        .insert(event)
        .values({
          title: input.title,
          summary: input.summary ?? "",
          body: input.body ?? "",
          category: input.category,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          location: input.location ?? null,
          isOnline: input.isOnline,
          coverImageUrl: input.coverImageUrl || null,
          relatedAnnouncementId: input.relatedAnnouncementId ?? null,
          status: "draft",
          audience: input.audience,
          createdBy: ctx.currentUser.id,
          seriesId: null,
          recurrenceFreq: input.recurrenceFreq,
          recurrenceInterval: input.recurrenceInterval,
          recurrenceEnd: input.recurrenceEnd,
          exceptionDates: JSON.stringify(input.exceptionDates),
        })
        .returning();
      if (!root) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create series" });
      // Only the root carries relatedAnnouncementId; instances leave it null.
      const duration =
        root.startsAt && root.endsAt ? root.endsAt.getTime() - root.startsAt.getTime() : null;
      const instanceRows: typeof event.$inferSelect[] = [];
      for (const occ of dates) {
        if (root.startsAt && occ.getTime() === root.startsAt.getTime()) continue;
        const [inst] = await ctx.db
          .insert(event)
          .values({
            title: root.title,
            summary: root.summary,
            body: root.body,
            category: root.category,
            startsAt: occ,
            endsAt: duration !== null ? new Date(occ.getTime() + duration) : null,
            location: root.location,
            isOnline: root.isOnline,
            coverImageUrl: root.coverImageUrl,
            relatedAnnouncementId: null,
            status: "draft",
            audience: root.audience,
            createdBy: ctx.currentUser.id,
            seriesId: root.id,
          })
          .returning();
        if (!inst) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create instance" });
        instanceRows.push(inst);
      }
      return { root, instances: instanceRows };
    }),

  listInRange: permissionProcedure("events:manage")
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(event)
        .where(and(gte(event.startsAt, input.from), lte(event.startsAt, input.to)))
        .orderBy(asc(event.startsAt));
    }),

  listPublishedInRange: protectedProcedure
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
    .query(async ({ ctx, input }) => {
      const { moduleEnabled, showPastEvents } = await readEventSettings(ctx.db);
      if (!moduleEnabled) return [];
      const myCohort = await getMyCohort(ctx.db, ctx.currentUser.id);
      const conditions = [
        eq(event.status, "published"),
        audienceCondition(event.audience, myCohort?.id ?? null),
        gte(event.startsAt, input.from),
        lte(event.startsAt, input.to),
      ];
      if (!showPastEvents) conditions.push(gte(event.startsAt, new Date()));
      return ctx.db
        .select()
        .from(event)
        .where(and(...conditions))
        .orderBy(asc(event.startsAt));
    }),

  cancelOccurrence: permissionProcedure("events:manage")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [instance] = await ctx.db
        .select()
        .from(event)
        .where(eq(event.id, input.id))
        .limit(1);
      if (!instance) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      if (!instance.seriesId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Event is not part of a series" });
      }
      if (!instance.startsAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Instance has no start date" });
      }
      const [root] = await ctx.db
        .select()
        .from(event)
        .where(eq(event.id, instance.seriesId))
        .limit(1);
      if (!root) throw new TRPCError({ code: "NOT_FOUND", message: "Series not found" });
      const key = dateKey(instance.startsAt);
      const exceptions = parseExceptions(root.exceptionDates);
      if (!exceptions.includes(key)) exceptions.push(key);
      await ctx.db
        .update(event)
        .set({ exceptionDates: JSON.stringify(exceptions), updatedAt: new Date() })
        .where(eq(event.id, root.id));
      await ctx.db.delete(event).where(eq(event.id, instance.id));
      return { deleted: true };
    }),

  addException: permissionProcedure("events:manage")
    .input(z.object({ seriesId: z.string(), date: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isValidDateKey(input.date)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Date must be yyyy-mm-dd" });
      }
      const [root] = await ctx.db
        .select()
        .from(event)
        .where(eq(event.id, input.seriesId))
        .limit(1);
      if (!root || !root.recurrenceFreq) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Series not found" });
      }
      const [y = 0, m = 0, d = 0] = input.date.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      if (
        root.startsAt &&
        root.recurrenceEnd &&
        (dateObj.getTime() < new Date(dateKey(root.startsAt) + "T00:00:00Z").getTime() ||
          dateObj.getTime() > root.recurrenceEnd.getTime())
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Date outside series window" });
      }
      const exceptions = parseExceptions(root.exceptionDates);
      if (!exceptions.includes(input.date)) exceptions.push(input.date);
      const [updatedRoot] = await ctx.db
        .update(event)
        .set({ exceptionDates: JSON.stringify(exceptions), updatedAt: new Date() })
        .where(eq(event.id, root.id))
        .returning();
      const [match] = await ctx.db
        .select()
        .from(event)
        .where(and(eq(event.seriesId, root.id), gte(event.startsAt, dateObj)))
        .limit(1);
      if (match && match.startsAt && dateKey(match.startsAt) === input.date) {
        await ctx.db.delete(event).where(eq(event.id, match.id));
      }
      return updatedRoot;
    }),

  removeException: permissionProcedure("events:manage")
    .input(z.object({ seriesId: z.string(), date: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isValidDateKey(input.date)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Date must be yyyy-mm-dd" });
      }
      const [root] = await ctx.db
        .select()
        .from(event)
        .where(eq(event.id, input.seriesId))
        .limit(1);
      if (!root || !root.recurrenceFreq) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Series not found" });
      }
      const exceptions = parseExceptions(root.exceptionDates).filter((x) => x !== input.date);
      const [updatedRoot] = await ctx.db
        .update(event)
        .set({ exceptionDates: JSON.stringify(exceptions), updatedAt: new Date() })
        .where(eq(event.id, root.id))
        .returning();
      return updatedRoot;
    }),
});
