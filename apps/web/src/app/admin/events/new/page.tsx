import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { hasPermission } from "@Alumni-Network/auth/permissions";

import { authClient } from "@/lib/auth-client";

import EventForm from "./form";

export default async function NewEventPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin" && !hasPermission(session.user, "events:manage")) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Admin
      </p>
      <h1 className="mt-2">New event</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Save a draft first, then publish from the event page when it is ready.
      </p>

      <EventForm />
    </main>
  );
}
