import { protectedProcedure, publicProcedure, router } from "../index";
import { accessRouter } from "./access";
import { alumniRouter } from "./alumni";
import { announcementsRouter } from "./announcements";
import { cohortsRouter } from "./cohorts";
import { eventsRouter } from "./events";
import { onboardingRouter } from "./onboarding";
import { profileRouter } from "./profile";
import { reportsRouter } from "./reports";
import { settingsRouter } from "./settings";

export const appRouter = router({
  access: accessRouter,
  onboarding: onboardingRouter,
  settings: settingsRouter,
  profile: profileRouter,
  events: eventsRouter,
  announcements: announcementsRouter,
  cohorts: cohortsRouter,
  alumni: alumniRouter,
  reports: reportsRouter,
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
