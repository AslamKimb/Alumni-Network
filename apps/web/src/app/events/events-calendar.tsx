"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

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

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EventsCalendar({ enabled }: { enabled: boolean }) {
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const range = useMemo(() => monthRange(cursor), [cursor]);
  const rangeQuery = useQuery({
    ...trpc.events.listPublishedInRange.queryOptions(range),
    enabled: enabled && !sessionPending && !!session?.user && flags.data?.events !== false,
  });

  const cells = monthCells(cursor);
  const dayMap = new Map<string, typeof rangeQuery.data>();
  for (const item of rangeQuery.data ?? []) {
    if (!item.startsAt) continue;
    const key = localDateKey(new Date(item.startsAt));
    const list = dayMap.get(key) ?? [];
    list.push(item);
    dayMap.set(key, list);
  }
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCursor((c) => shiftMonth(c, -1))}
          className="rounded-md border px-4 py-2 text-sm"
        >
          Previous
        </button>
        <p className="min-w-36 text-center text-sm font-medium">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setCursor((c) => shiftMonth(c, 1))}
          className="rounded-md border px-4 py-2 text-sm"
        >
          Next
        </button>
      </div>

      {rangeQuery.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : rangeQuery.isError ? (
        <p className="mt-8 text-sm text-destructive">Could not load calendar.</p>
      ) : (rangeQuery.data?.length ?? 0) === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No events this month.</p>
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
              const items = dayMap.get(key) ?? [];
              const inMonth = day.getMonth() === cursor.getMonth();
              return (
                <div key={key} className={`min-h-24 border-t border-r px-2 py-2 ${inMonth ? "" : "bg-muted/30"}`}>
                  <p className={`text-xs font-medium ${inMonth ? "" : "text-muted-foreground"}`}>{day.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/events/${item.id}`}
                        className="block truncate rounded bg-secondary px-1.5 py-0.5 text-xs"
                        title={`${item.title} — ${item.startsAt ? new Date(item.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`}
                      >
                        {item.startsAt
                          ? `${new Date(item.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ${item.seriesId ? "↻ " : ""}${item.title}`
                          : `${item.seriesId ? "↻ " : ""}${item.title}`}
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
  );
}
