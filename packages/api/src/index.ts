import { user } from "@Alumni-Network/db/schema/auth";
import { hasPermission } from "@Alumni-Network/auth/permissions";
import type { PermissionKey } from "@Alumni-Network/auth/permissions";
import { eq } from "drizzle-orm";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export type CurrentUser = {
  id: string;
  role: string;
  permissions: string;
  deactivatedAt: Date | null;
};

// The role is re-read from the database on every call. A session cookie alone
// never authorizes anything: a deactivated or deleted account fails here.
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }

  const [currentUser] = await ctx.db
    .select({
      id: user.id,
      role: user.role,
      permissions: user.permissions,
      deactivatedAt: user.deactivatedAt,
    })
    .from(user)
    .where(eq(user.id, ctx.session.user.id))
    .limit(1);

  if (!currentUser || currentUser.deactivatedAt) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "This account is not active",
      cause: "Inactive account",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      currentUser,
    },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.currentUser.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
      cause: "Insufficient role",
    });
  }
  return next();
});

export const permissionProcedure = (key: PermissionKey) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!hasPermission(ctx.currentUser, key)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${key}`,
        cause: "Insufficient permission",
      });
    }
    return next();
  });
