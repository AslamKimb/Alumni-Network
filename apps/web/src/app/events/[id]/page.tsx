"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

import EventsDetail from "../detail";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());

  if (sessionPending) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!session?.user) {
    router.replace("/login");
    return null;
  }

  if (flags.data?.events === false) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
      <EventsDetail id={id} />
    </main>
  );
}
