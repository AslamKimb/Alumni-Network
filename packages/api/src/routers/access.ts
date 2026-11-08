import type { Database } from "@Alumni-Network/db";
import { session, user } from "@Alumni-Network/db/schema/auth";
import { TRPCError } from "@trpc/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, router } from "../index";

const LAST_ADMIN_MESSAGE = "The last remaining admin cannot be demoted, deactivated, or deleted.";

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

export const accessRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        deactivatedAt: user.deactivatedAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(user.createdAt);

    return { accounts, activeAdmins: await activeAdminCount(ctx.db) };
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
});
