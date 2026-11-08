import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import AuthSettings from "./auth-settings";

export default async function AdminAuthSettingsPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Admin
      </p>
      <h1 className="mt-2">Auth</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Control who can create an account. Existing alumni can always sign in.
      </p>

      <AuthSettings />
    </main>
  );
}
