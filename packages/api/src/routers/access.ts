import type { Database } from "@Alumni-Network/db";
import { session, user } from "@Alumni-Network/db/schema/auth";
import { PERMISSION_KEYS, parsePermissions } from "@Alumni-Network/auth/permissions";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, isNotNull, isNull, like, or } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router } from "../index";

const LAST_ADMIN_MESSAGE = "The last remaining admin cannot be demoted, deactivated, or deleted.";

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS);

async function activeAdminCount(db: Database) {
  const [row] = await db
    .select({ value: count() })
    .from(user)
    .where(and(eq(user.role, "admin"), isNull(user.deactivatedAt)));
  return row?.value ?? 0;
}

async function findTarget(db: Database, userId: string) {
  const [target] = await db
    .select({
      id: user.id,
      role: user.role,
      deactivatedAt: user.deactivatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return target;
}

const listInput = z.object({
  search: z.string().trim().max(200).optional().nullable(),
  role: z.enum(["all", "admin", "alumnus"]).optional().nullable(),
  status: z.enum(["all", "active", "deactivated"]).optional().nullable(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const accessRouter = router({
  list: adminProcedure.input(listInput.optional()).query(async ({ ctx, input }) => {
    const { search, role, status, page, pageSize } = input ?? { search: undefined, role: undefined, status: undefined, page: 1, pageSize: 25 };

    const conditions = [];
    const term = search?.trim();
    if (term) {
      const pattern = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
      conditions.push(or(like(user.name, pattern), like(user.email, pattern)));
    }
    if (role && role !== "all") conditions.push(eq(user.role, role));
    if (status === "active") conditions.push(isNull(user.deactivatedAt));
    else if (status === "deactivated") conditions.push(isNotNull(user.deactivatedAt));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          deactivatedAt: user.deactivatedAt,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      ctx.db.select({ value: count() }).from(user).where(where),
    ]);

    const filteredCount = totalRows[0]?.value ?? 0;
    const accounts = rows.map((account) => ({
      ...account,
      permissions: parsePermissions(account.permissions),
    }));

    return { accounts, total: filteredCount, filteredCount, activeAdmins: await activeAdminCount(ctx.db) };
  }),

  setRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["alumnus", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      const target = await findTarget(ctx.db, input.userId);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      if (target.role === input.role) return;

      const demotingActiveAdmin =
        target.role === "admin" && target.deactivatedAt === null && (await activeAdminCount(ctx.db)) <= 1;
      if (demotingActiveAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: LAST_ADMIN_MESSAGE });
      }

      await ctx.db.update(user).set({ role: input.role }).where(eq(user.id, input.userId));
    }),

  setActive: adminProcedure
    .input(z.object({ userId: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const target = await findTarget(ctx.db, input.userId);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      if (input.active) {
        await ctx.db
          .update(user)
          .set({ deactivatedAt: null })
          .where(eq(user.id, input.userId));
        return;
      }

      if (target.deactivatedAt !== null) return;
      if (target.role === "admin" && (await activeAdminCount(ctx.db)) <= 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: LAST_ADMIN_MESSAGE });
      }

      await ctx.db
        .update(user)
        .set({ deactivatedAt: new Date() })
        .where(eq(user.id, input.userId));
      await ctx.db.delete(session).where(eq(session.userId, input.userId));
    }),

  setPermissions: adminProcedure
    .input(z.object({ userId: z.string(), permissions: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (const key of input.permissions) {
        if (!PERMISSION_KEY_SET.has(key)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown permission: ${key}`,
          });
        }
      }

      const target = await findTarget(ctx.db, input.userId);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      await ctx.db
        .update(user)
        .set({ permissions: JSON.stringify(parsePermissions(JSON.stringify(input.permissions))) })
        .where(eq(user.id, input.userId));
    }),
});
