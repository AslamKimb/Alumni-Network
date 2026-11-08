import type { Database } from "@Alumni-Network/db";
import {
  MODULE_NAMES,
  authSettingsInput,
  invalidEmailDomains,
  organizationSettingsInput,
  readAuthSettings,
  readModuleSettings,
  readOrganizationSettings,
  writeAuthSettings,
  writeModuleSettings,
  writeOrganizationSettings,
} from "@Alumni-Network/db/settings";
import type { ModuleName } from "@Alumni-Network/db/settings";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, permissionProcedure, publicProcedure, router } from "../index";

// Settings-area gating helper (PRODUCT §4.7/§7.3). Data is retained while a
// module is disabled; callers hide nav links and return not-found for routes
// when this is false. Profile has no module_enabled key, so it stays enabled.
// The Settings area itself must never call this — it stays reachable even when
// every module is disabled.
export async function isModuleEnabled(db: Database, module: ModuleName): Promise<boolean> {
  if (module === "profile") return true;
  const settings = await readModuleSettings(db, module);
  return settings.moduleEnabled !== false;
}

export const settingsRouter = router({
  auth: adminProcedure.query(async ({ ctx }) => {
    return readAuthSettings(ctx.db);
  }),

  updateAuth: adminProcedure.input(authSettingsInput).mutation(async ({ ctx, input }) => {
    const invalid = invalidEmailDomains(input.allowedEmailDomains);
    if (invalid.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Not a valid domain: ${invalid.join(", ")}. Use a form like example.edu.`,
      });
    }
    return writeAuthSettings(ctx.db, input, ctx.currentUser.id);
  }),

  // The sign-in screen needs this before anyone is authenticated.
  publicAuth: publicProcedure.query(async ({ ctx }) => {
    const { signupsOpen } = await readAuthSettings(ctx.db);
    return { signupsOpen };
  }),

  // Public read for the landing page and app header (PRODUCT §7.2).
  getOrganization: publicProcedure.query(async ({ ctx }) => {
    return readOrganizationSettings(ctx.db);
  }),

  // Public module flags for nav hiding and route guards (PRODUCT §7.3).
  publicModuleFlags: publicProcedure.query(async ({ ctx }) => {
    const [events, records, reports] = await Promise.all([
      isModuleEnabled(ctx.db, "events"),
      isModuleEnabled(ctx.db, "records"),
      isModuleEnabled(ctx.db, "reports"),
    ]);
    return { events, records, reports };
  }),

  saveOrganization: permissionProcedure("settings:manage")
    .input(organizationSettingsInput)
    .mutation(async ({ ctx, input }) => {
      return writeOrganizationSettings(ctx.db, input, ctx.currentUser.id);
    }),

  getModuleSettings: permissionProcedure("settings:manage")
    .input(z.object({ module: z.enum(MODULE_NAMES) }))
    .query(async ({ ctx, input }) => {
      return readModuleSettings(ctx.db, input.module);
    }),

  saveModuleSettings: permissionProcedure("settings:manage")
    .input(
      z.object({
        module: z.enum(MODULE_NAMES),
        values: z.record(z.string(), z.union([z.boolean(), z.number()])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await writeModuleSettings(ctx.db, input.module, input.values, ctx.currentUser.id);
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),
});
