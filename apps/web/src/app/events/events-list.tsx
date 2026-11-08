"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

function fmt(date: Date | null) {
  if (!date) return "TBA";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Card({ item }: { item: { id: string; title: string; category: string; startsAt: Date | string | null; location: string | null; isOnline: boolean } }) {
  return (
    <Link href={`/events/${item.id}`} className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/60">
      <span className="inline-flex rounded-sm bg-secondary px-3 py-1 text-xs font-medium tracking-[0.5px] uppercase">
        {item.category}
      </span>
      <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {fmt(typeof item.startsAt === "string" ? new Date(item.startsAt) : item.startsAt)} ·{" "}
        {item.isOnline ? "Online" : (item.location ?? "Online")}
      </p>
    </Link>
  );
}

export default function EventsList() {
  const trpc = useTRPC();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());
  const published = useQuery({
    ...trpc.events.listPublished.queryOptions(),
    enabled: flags.data?.events !== false,
  });

  if (flags.data?.events === false) {
    return (
      <div className="mt-10">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </div>
    );
  }
  if (published.isPending) return <p className="mt-10 text-sm text-muted-foreground">Loading…</p>;
  if (published.isError || !published.data) {
    return <p className="mt-10 text-sm text-muted-foreground">Could not load events.</p>;
  }

  const { upcoming, past, showPastEvents } = published.data;
  const active = tab === "upcoming" ? upcoming : past;

  return (
    <>
      <div className="mt-6 flex gap-2" role="tablist" aria-label="Event periods">
        <button
          role="tab"
          aria-selected={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
          className={tab === "upcoming" ? "rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" : "rounded-md border px-4 py-2 text-sm"}
        >
          Upcoming
        </button>
        {showPastEvents && (
          <button
            role="tab"
            aria-selected={tab === "past"}
            onClick={() => setTab("past")}
            className={tab === "past" ? "rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" : "rounded-md border px-4 py-2 text-sm"}
          >
            Past
          </button>
        )}
      </div>

      {active.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {tab === "upcoming" ? "No upcoming events yet." : "No past events."}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {active.map((item) => (
            <Card key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
