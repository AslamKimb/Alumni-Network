import { announcement } from "@Alumni-Network/db/schema/announcement";
import { user } from "@Alumni-Network/db/schema/auth";
import { event } from "@Alumni-Network/db/schema/event";
import type { Database } from "@Alumni-Network/db";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gt, like, or } from "drizzle-orm";
import { z } from "zod";

import { audienceCondition, getMyCohort, validateAudience } from "../cohorts-helper";
import { permissionProcedure, protectedProcedure, router } from "../index";

const STATUSES = ["draft", "published"] as const;

const titleField = z
  .string()
  .trim()
  .min(3, "Title must be at least 3 characters")
  .max(140, "Title must be 140 characters or fewer");

const bodyField = z.string().max(20000, "Body must be 20000 characters or fewer");

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

const coverImageUrlField = z
  .string()
  .trim()
  .max(500)
  .refine((v) => httpsUrl(v), "Cover image must be an HTTPS URL")
  .optional()
  .nullable();

const relatedEventIdField = z.string().trim().min(1).optional().nullable();

async function requireEventExists(db: Database, relatedEventId: string | null | undefined) {
  if (relatedEventId == null) return;
  const [row] = await db
    .select({ id: event.id })
    .from(event)
    .where(eq(event.id, relatedEventId))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
}

async function requirePublishable(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(announcement)
    .where(eq(announcement.id, id))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });

  const missing: string[] = [];
  if (!row.title.trim()) missing.push("title");
  if (!row.body.trim()) missing.push("body");
  if (missing.length > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Cannot publish: missing ${missing.join(", ")}`,
    });
  }
  return row;
}

const listAdminInput = z.object({
  search: z.string().trim().max(200).optional().nullable(),
  status: z.enum(STATUSES).optional().nullable(),
});

export const announcementsRouter = router({
  listAdmin: permissionProcedure("announcements:manage")
    .input(listAdminInput)
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) {
        conditions.push(
          or(
            like(announcement.title, `%${input.search}%`),
            like(announcement.body, `%${input.search}%`),
          ),
        );
      }
      if (input.status) conditions.push(eq(announcement.status, input.status));

      return ctx.db
        .select()
        .from(announcement)
        .where(and(...conditions))
        .orderBy(desc(announcement.createdAt));
    }),

  create: permissionProcedure("announcements:manage")
    .input(
      z.object({
        title: titleField,
        body: bodyField.optional().nullable(),
        audience: z.string().default("all"),
        coverImageUrl: coverImageUrlField,
        relatedEventId: relatedEventIdField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await validateAudience(ctx.db, input.audience);
      if (input.coverImageUrl && !httpsUrl(input.coverImageUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cover image must be an HTTPS URL" });
      }
      await requireEventExists(ctx.db, input.relatedEventId);
      const [row] = await ctx.db
        .insert(announcement)
        .values({
          title: input.title,
          body: input.body ?? "",
          status: "draft",
          audience: input.audience,
          coverImageUrl: input.coverImageUrl || null,
          relatedEventId: input.relatedEventId ?? null,
          createdBy: ctx.currentUser.id,
        })
        .returning();
      return row;
    }),

  update: permissionProcedure("announcements:manage")
    .input(
      z.object({
        id: z.string(),
        title: titleField.optional(),
        body: bodyField.optional().nullable(),
        audience: z.string().optional(),
        coverImageUrl: coverImageUrlField,
        relatedEventId: relatedEventIdField,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, title, body, audience, coverImageUrl, relatedEventId } = input;
      if (audience !== undefined) await validateAudience(ctx.db, audience);
      await requireEventExists(ctx.db, relatedEventId);
      const [existing] = await ctx.db
        .select()
        .from(announcement)
        .where(eq(announcement.id, id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });

      const merged = {
        title: title === undefined ? existing.title : title,
        body: body === undefined ? existing.body : (body ?? ""),
        coverImageUrl:
          coverImageUrl === undefined ? existing.coverImageUrl : (coverImageUrl || null),
        relatedEventId:
          relatedEventId === undefined ? existing.relatedEventId : (relatedEventId ?? null),
      };
      if (merged.coverImageUrl && !httpsUrl(merged.coverImageUrl)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cover image must be an HTTPS URL" });
      }

      if (existing.status === "published") {
        const missing: string[] = [];
        if (
          !merged.title.trim() ||
          merged.title.trim().length < 3 ||
          merged.title.length > 140
        ) {
          missing.push("title");
        }
        if (!merged.body || !merged.body.trim() || merged.body.length > 20000) {
          missing.push("body");
        }
        if (missing.length > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot save published announcement: invalid or missing ${missing.join(", ")}`,
          });
        }
      }

      const [row] = await ctx.db
        .update(announcement)
        .set({
          title: merged.title,
          body: merged.body,
          ...(audience !== undefined ? { audience } : {}),
          coverImageUrl: merged.coverImageUrl,
          relatedEventId: merged.relatedEventId,
          updatedAt: new Date(),
        })
        .where(eq(announcement.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });
      return row;
    }),

  publish: permissionProcedure("announcements:manage")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePublishable(ctx.db, input.id);
      const [row] = await ctx.db
        .update(announcement)
        .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(announcement.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });
      return row;
    }),

  unpublish: permissionProcedure("announcements:manage")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(announcement)
        .set({ status: "draft", publishedAt: null, updatedAt: new Date() })
        .where(eq(announcement.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });
      return row;
    }),

  delete: permissionProcedure("announcements:manage")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .delete(announcement)
        .where(eq(announcement.id, input.id))
        .returning({ id: announcement.id });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });
      return { deleted: true };
    }),

  getById: permissionProcedure("announcements:manage")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(announcement)
        .where(eq(announcement.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });
      return row;
    }),

  listPublished: protectedProcedure.query(async ({ ctx }) => {
    const myCohort = await getMyCohort(ctx.db, ctx.currentUser.id);
    return ctx.db
      .select()
      .from(announcement)
      .where(
        and(
          eq(announcement.status, "published"),
          audienceCondition(announcement.audience, myCohort?.id ?? null),
        ),
      )
      .orderBy(desc(announcement.publishedAt));
  }),

  getPublishedById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const myCohort = await getMyCohort(ctx.db, ctx.currentUser.id);
      const [row] = await ctx.db
        .select()
        .from(announcement)
        .where(
          and(
            eq(announcement.id, input.id),
            eq(announcement.status, "published"),
            audienceCondition(announcement.audience, myCohort?.id ?? null),
          ),
        )
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Announcement not found" });
      return row;
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const seenAt = ctx.currentUser.announcementSeenAt;
    const myCohort = await getMyCohort(ctx.db, ctx.currentUser.id);
    const base = and(
      eq(announcement.status, "published"),
      audienceCondition(announcement.audience, myCohort?.id ?? null),
    );
    const [row] = await ctx.db
      .select({ value: count() })
      .from(announcement)
      .where(seenAt ? and(base, gt(announcement.publishedAt, seenAt)) : base);
    return { count: row?.value ?? 0 };
  }),

  markRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(user)
      .set({ announcementSeenAt: new Date() })
      .where(eq(user.id, ctx.currentUser.id));
    return { ok: true };
  }),
});
