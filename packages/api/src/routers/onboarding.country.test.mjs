import { expect, test } from "bun:test";

import { alumniProfile, user } from "@Alumni-Network/db/schema/auth";

import { COUNTRIES } from "../countries.ts";
import { onboardingRouter } from "./onboarding.ts";

const userId = "country-user";
const profile = { id: "country-profile", userId };

function createCaller() {
  const updates = [];
  const db = {
    select: () => ({
      from: (table) => ({
        where: () => ({
          limit: async () =>
            table === user
              ? [{ id: userId, role: "alumnus", deactivatedAt: null }]
              : [profile],
        }),
      }),
    }),
    update: (table) => ({
      set: (values) => ({
        where: async () => {
          if (table === alumniProfile) updates.push(values);
        },
      }),
    }),
  };

  return {
    caller: onboardingRouter.createCaller({
      db,
      session: { user: { id: userId, name: "Country User" } },
    }),
    updates,
  };
}

function step2Input(countryCode) {
  return {
    countryCode,
    city: "Toronto",
    region: null,
    workStatus: "other",
    professionalTitle: null,
    employer: null,
    bio: null,
  };
}

test("country options contain the current unique ISO alpha-2 codes", () => {
  const codes = COUNTRIES.map(({ code }) => code);

  expect(codes).toHaveLength(248);
  expect(new Set(codes).size).toBe(248);
});

for (const countryCode of ["ZZ", "UK", "XK"]) {
  test(`saveStep2 rejects non-ISO country code ${countryCode}`, async () => {
    const { caller, updates } = createCaller();

    await expect(caller.saveStep2(step2Input(countryCode))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(updates).toHaveLength(0);
  });
}

for (const countryCode of ["BD", "CA", "EH", "ZW"]) {
  test(`saveStep2 accepts ISO country code ${countryCode}`, async () => {
    const { caller, updates } = createCaller();

    await caller.saveStep2(step2Input(countryCode));
    expect(updates[0].countryCode).toBe(countryCode);
  });
}
