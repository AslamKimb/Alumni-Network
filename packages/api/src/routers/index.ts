import { protectedProcedure, publicProcedure, router } from "../index";
import { accessRouter } from "./access";
import { onboardingRouter } from "./onboarding";
import { settingsRouter } from "./settings";

export const appRouter = router({
  access: accessRouter,
  onboarding: onboardingRouter,
  settings: settingsRouter,
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
