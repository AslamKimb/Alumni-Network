"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CohortCard } from "@/components/cohorts";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

import EventsCalendar from "./events-calendar";
import EventsList from "./events-list";

export default function EventsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());
  const [view, setView] = useState<"calendar" | "list">("calendar");

  if (sessionPending) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
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
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Alumni Network
      </p>
      <h1 className="mt-2">Events</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        News and gatherings from the alumni office.
      </p>
      <CohortCard />

      <div className="mt-6 flex gap-2" role="tablist" aria-label="Event views">
        <button
          role="tab"
          aria-selected={view === "calendar"}
          onClick={() => setView("calendar")}
          className={view === "calendar" ? "rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" : "rounded-md border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}
        >
          Calendar
        </button>
        <button
          role="tab"
          aria-selected={view === "list"}
          onClick={() => setView("list")}
          className={view === "list" ? "rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" : "rounded-md border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"}
        >
          List
        </button>
      </div>

      {view === "calendar" ? <EventsCalendar enabled={view === "calendar"} /> : <EventsList />}
    </main>
  );
}
