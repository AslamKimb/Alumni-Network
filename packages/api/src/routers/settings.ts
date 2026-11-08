import {
  authSettingsInput,
  invalidEmailDomains,
  readAuthSettings,
  writeAuthSettings,
} from "@Alumni-Network/db/settings";
import { TRPCError } from "@trpc/server";

import { adminProcedure, publicProcedure, router } from "../index";

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
});
