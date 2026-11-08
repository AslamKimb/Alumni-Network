import { expect, test } from "bun:test";

import { alumniProfile, user } from "@Alumni-Network/db/schema/auth";

import { onboardingRouter } from "./onboarding.ts";

const userId = "legacy-user";

function createCaller(userName = "Legacy User") {
  let insertedProfile;
  let updatedUserName = userName;
  const db = {
    select: () => ({
      from: (table) => ({
        where: () => ({
          limit: async () =>
            table === user
              ? [{ id: userId, role: "alumnus", deactivatedAt: null }]
              : [],
        }),
      }),
    }),
    insert: (table) => ({
      values: (values) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (table === alumniProfile) {
              insertedProfile = values;
              return [{ id: "legacy-profile" }];
            }
            return [];
          },
        }),
      }),
    }),
    update: (table) => ({
      set: (values) => ({
        where: async () => {
          if (table === user) updatedUserName = values.name;
        },
      }),
    }),
    transaction: async (callback) => callback(db),
  };

  const caller = onboardingRouter.createCaller({
    db,
    session: { user: { id: userId, name: userName } },
  });

  return {
    caller,
    getInsertedProfile: () => insertedProfile,
    getUpdatedUserName: () => updatedUserName,
  };
}

for (const input of [undefined, false]) {
  test(`legacy profile creation rejects ${String(input)} consent`, async () => {
    const { caller, getInsertedProfile } = createCaller();

    await expect(caller.acceptConsent(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getInsertedProfile()).toBeUndefined();
  });
}

test("affirmative consent stores server-generated consent timestamp", async () => {
  const { caller, getInsertedProfile, getUpdatedUserName } = createCaller();

  await expect(
    caller.acceptConsent({ consent: true, fullName: "Legacy User" }),
  ).resolves.toEqual({ created: true });
  expect(getInsertedProfile().consentAt).toBeInstanceOf(Date);
  expect(getInsertedProfile().fullName).toBe("Legacy User");
  expect(getUpdatedUserName()).toBe("Legacy User");
});

for (const fullName of ["A", "x".repeat(121)]) {
  test(`legacy consent rejects name with ${fullName.length} characters`, async () => {
    const { caller, getInsertedProfile, getUpdatedUserName } = createCaller(fullName);

    await expect(caller.acceptConsent({ consent: true, fullName })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(getInsertedProfile()).toBeUndefined();
    expect(getUpdatedUserName()).toBe(fullName);
  });
}

test("legacy consent can correct an invalid stored name", async () => {
  const { caller, getInsertedProfile, getUpdatedUserName } = createCaller("A");

  await caller.acceptConsent({ consent: true, fullName: "Corrected Name" });
  expect(getInsertedProfile().fullName).toBe("Corrected Name");
  expect(getUpdatedUserName()).toBe("Corrected Name");
});

for (const fullName of ["Al", "x".repeat(120)]) {
  test(`legacy consent accepts name with ${fullName.length} characters`, async () => {
    const { caller, getInsertedProfile, getUpdatedUserName } = createCaller("A");

    await caller.acceptConsent({ consent: true, fullName });
    expect(getInsertedProfile().fullName).toBe(fullName);
    expect(getUpdatedUserName()).toBe(fullName);
  });
}
