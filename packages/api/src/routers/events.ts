import { appSetting } from "@Alumni-Network/db/schema/setting";
import { event } from "@Alumni-Network/db/schema/event";
import type { Database } from "@Alumni-Network/db";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, like, lte, or } from "drizzle-orm";
import { z } from "zod";

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
        status: "draft",
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

      const merged = {
        title: values.title,
        summary: values.summary === undefined ? existing.summary : (values.summary ?? ""),
        body: values.body === undefined ? existing.body : (values.body ?? ""),
        category: values.category,
        startsAt: values.startsAt === undefined ? existing.startsAt : (values.startsAt ?? null),
        endsAt: values.endsAt === undefined ? existing.endsAt : (values.endsAt ?? null),
        location: values.location === undefined ? existing.location : (values.location ?? null),
        isOnline: values.isOnline,
        coverImageUrl:
          values.coverImageUrl === undefined
            ? existing.coverImageUrl
            : (values.coverImageUrl || null),
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
          coverImageUrl: merged.coverImageUrl,
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

    const now = new Date();
    const base = eq(event.status, "published");

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
      const [row] = await ctx.db
        .select()
        .from(event)
        .where(and(eq(event.id, input.id), eq(event.status, "published")))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      return row;
    }),
});
