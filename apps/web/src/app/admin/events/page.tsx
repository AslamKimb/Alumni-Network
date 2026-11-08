"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { hasPermission } from "@Alumni-Network/auth/permissions";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

import AdminEventsList from "./list";

export default function AdminEventsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());

  if (sessionPending) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!session?.user) {
    router.replace("/login");
    return null;
  }

  if (session.user.role !== "admin" && !hasPermission(session.user, "events:manage")) {
    router.replace("/dashboard");
    return null;
  }

  if (flags.data?.events === false) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Events</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Draft, publish, and delete the items alumni see under Events.
      </p>

      <AdminEventsList />
    </main>
  );
}
