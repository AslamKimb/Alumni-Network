"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { hasPermission } from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

import AdminEventsList from "./list";
import { localDateKey } from "./recurrence";

type CalendarEvent = { id: string; title: string; startsAt: string | Date | null };

function monthRange(cursor: Date) {
  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = first.getDay(); // Sunday-first grid
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function shiftMonth(cursor: Date, delta: number): Date {
  return new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
}

export default function AdminEventsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const range = useMemo(() => monthRange(cursor), [cursor]);
  const rangeQuery = useQuery({
    ...trpc.events.listInRange.queryOptions(range),
    enabled: !sessionPending && !!session?.user && view === "calendar",
  });

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

  const cells = monthCells(cursor);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const item of rangeQuery.data ?? []) {
    if (!item.startsAt) continue;
    const key = localDateKey(new Date(item.startsAt));
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Events</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Draft, publish, and delete the items alumni see under Events.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button type="button" variant={view === "calendar" ? "default" : "outline"} onClick={() => setView("calendar")}>
          Calendar
        </Button>
        <Button type="button" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>
          List
        </Button>
        <Link href="/admin/events/new" className="ml-auto">
          <Button>New event</Button>
        </Link>
      </div>

      {view === "calendar" ? (
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setCursor((c) => shiftMonth(c, -1))}>
              Previous
            </Button>
            <p className="min-w-36 text-center text-sm font-medium">{monthLabel}</p>
            <Button type="button" variant="outline" onClick={() => setCursor((c) => shiftMonth(c, 1))}>
              Next
            </Button>
            <p className="ml-auto text-xs text-muted-foreground">Filters apply to List view; Calendar shows all events this month.</p>
          </div>

          {rangeQuery.isPending ? (
            <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
          ) : rangeQuery.isError ? (
            <p className="mt-8 text-sm text-destructive">Could not load calendar.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <div className="grid grid-cols-7 bg-muted/60 text-xs font-medium">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="px-2 py-2 text-center">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day) => {
                  const key = localDateKey(day);
                  const items = byDay.get(key) ?? [];
                  const inMonth = day.getMonth() === cursor.getMonth();
                  return (
                    <div key={key} className={`min-h-24 border-t border-r px-2 py-2 ${inMonth ? "" : "bg-muted/30"}`}>
                      <p className={`text-xs font-medium ${inMonth ? "" : "text-muted-foreground"}`}>{day.getDate()}</p>
                      <div className="mt-1 space-y-1">
                        {items.map((item) => (
                          <Link
                            key={item.id}
                            href={`/admin/events/${item.id}`}
                            className="block truncate rounded bg-secondary px-1.5 py-0.5 text-xs"
                            title={`${item.title} — ${item.startsAt ? new Date(item.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`}
                          >
                            {item.startsAt
                              ? `${new Date(item.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ${item.title}`
                              : item.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <AdminEventsList />
      )}
    </main>
  );
}
