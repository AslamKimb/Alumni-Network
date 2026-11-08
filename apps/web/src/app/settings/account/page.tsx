import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import AccountSettings from "./account-settings";

export default async function AccountSettingsPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Settings
      </p>
      <h1 className="mt-2">Account</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your email and password. Your name, location, and work details live in your profile.
      </p>

      <AccountSettings />
    </main>
  );
}
