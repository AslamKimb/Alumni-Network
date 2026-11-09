"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@Alumni-Network/ui/components/button";

import { useTRPC, useTRPCClient } from "@/utils/trpc";

import { EventPreview, toInput, type EventFormValues } from "../form-preview";

type SeriesFields = {
  id: string;
  seriesId?: string | null;
  recurrenceFreq?: "daily" | "weekly" | "monthly" | null;
  recurrenceInterval?: number | null;
  recurrenceEnd?: string | Date | null;
  exceptionDates?: unknown;
};

type SeriesClient = {
  cancelOccurrence: { mutate: (input: { id: string }) => Promise<unknown> };
  addException: { mutate: (input: { seriesId: string; date: string }) => Promise<unknown> };
  removeException: { mutate: (input: { seriesId: string; date: string }) => Promise<unknown> };
};

export function getSeriesFields(row: unknown): SeriesFields {
  const r = (row ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    seriesId: (r.seriesId as string | null | undefined) ?? null,
    recurrenceFreq: ((r.recurrenceFreq as SeriesFields["recurrenceFreq"]) ?? null) as SeriesFields["recurrenceFreq"],
    recurrenceInterval: (r.recurrenceInterval as number | null | undefined) ?? null,
    recurrenceEnd: (r.recurrenceEnd as string | Date | null | undefined) ?? null,
    exceptionDates: r.exceptionDates ?? null,
  };
}

export function exceptionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).slice(0, 10));
}

export function freqLabel(freq: SeriesFields["recurrenceFreq"], interval: number | null | undefined): string {
  if (!freq) return "";
  const n = interval ?? 1;
  return freq === "daily" ? `every ${n} day${n === 1 ? "" : "s"}` : freq === "weekly" ? `every ${n} week${n === 1 ? "" : "s"}` : `every ${n} month${n === 1 ? "" : "s"}`;
}

function toLocalInput(date: Date | string | null) {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventForm({ id }: { id: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<EventFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exceptionDraft, setExceptionDraft] = useState("");

  const detail = useQuery(trpc.events.getById.queryOptions({ id }));

  useEffect(() => {
    if (detail.data) {
      const row = detail.data;
      setValues({
        title: row.title,
        summary: row.summary,
        body: row.body,
        category: (row.category as "event" | "update") ?? "event",
        startsAt: toLocalInput(row.startsAt),
        endsAt: toLocalInput(row.endsAt),
        location: row.location ?? "",
        isOnline: row.isOnline,
        coverImageUrl: row.coverImageUrl ?? "",
      });
    }
  }, [detail.data]);

  const seriesClient = trpcClient.events as unknown as SeriesClient;
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.events.getById.queryKey() });
  const onError = (err: { message: string }) => setError(err.message);

  const cancelOccurrence = useMutation({
    mutationFn: (input: { id: string }) => seriesClient.cancelOccurrence.mutate(input),
    onSuccess: () => {
      toast.success("Occurrence cancelled");
      router.push("/admin/events");
    },
    onError,
  });
  const addException = useMutation({
    mutationFn: (input: { seriesId: string; date: string }) => seriesClient.addException.mutate(input),
    onSuccess: () => {
      toast.success("Exception added");
      setExceptionDraft("");
      refresh();
    },
    onError,
  });
  const removeException = useMutation({
    mutationFn: (input: { seriesId: string; date: string }) => seriesClient.removeException.mutate(input),
    onSuccess: () => {
      toast.success("Exception removed");
      refresh();
    },
    onError,
  });

  const update = useMutation(
    trpc.events.update.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Saved");
      },
      onError,
    }),
  );
  const publish = useMutation(
    trpc.events.publish.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Published");
      },
      onError,
    }),
  );
  const unpublish = useMutation(
    trpc.events.unpublish.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Unpublished");
      },
      onError,
    }),
  );
  const remove = useMutation(
    trpc.events.delete.mutationOptions({
      onSuccess: () => router.push("/admin/events"),
      onError,
    }),
  );

  if (detail.isError || !detail.data) {
    notFound();
    return null;
  }
  if (detail.isPending || !values) return <p className="mt-10 text-sm text-muted-foreground">Loading…</p>;

  const series = getSeriesFields(detail.data);
  const isOccurrence = !!series.seriesId;
  const rootId = series.seriesId ?? series.id ?? id;
  const exceptions = exceptionList(series.exceptionDates);
  const repeatText = freqLabel(series.recurrenceFreq, series.recurrenceInterval);
  const repeatEndText = series.recurrenceEnd ? new Date(series.recurrenceEnd).toLocaleDateString() : null;

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((v) => (v ? { ...v, [key]: value } : v));

  const busy =
    update.isPending ||
    publish.isPending ||
    unpublish.isPending ||
    remove.isPending ||
    cancelOccurrence.isPending ||
    addException.isPending ||
    removeException.isPending;

  return (
    <div className="mt-6 grid gap-8 md:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          update.mutate({ id, ...toInput(values) });
        }}
        className="space-y-4"
      >
        {isOccurrence && (
          <div className="rounded-md border bg-secondary/50 p-3 text-sm">
            <p className="font-medium">Part of recurring series{repeatText ? `, ${repeatText}` : ""}{repeatEndText ? ` until ${repeatEndText}` : ""}</p>
            <Link href={`/admin/events/${series.seriesId}`} className="text-highlight underline">
              Open series root
            </Link>
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Cancel this occurrence?")) cancelOccurrence.mutate({ id });
                }}
              >
                Cancel this occurrence
              </Button>
            </div>
          </div>
        )}

        {series.recurrenceFreq && (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Series exceptions</p>
            <div className="mt-2 flex gap-2">
              <input
                value={exceptionDraft}
                onChange={(e) => setExceptionDraft(e.target.value)}
                placeholder="yyyy-mm-dd"
                className="h-10 flex-1 rounded-md border px-3"
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy || !/^\d{4}-\d{2}-\d{2}$/.test(exceptionDraft)}
                onClick={() => addException.mutate({ seriesId: rootId, date: exceptionDraft })}
              >
                Add
              </Button>
            </div>
            {exceptions.length === 0 ? (
              <p className="mt-2 text-muted-foreground">No exception dates.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                {exceptions.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs">
                    {d}
                    <button type="button" aria-label={`Remove ${d}`} disabled={busy} onClick={() => removeException.mutate({ seriesId: rootId, date: d })}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">Status: {detail.data.status}</p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            required
            minLength={3}
            maxLength={140}
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            className="h-10 rounded-md border px-3"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Summary</span>
          <input
            maxLength={160}
            value={values.summary}
            onChange={(e) => set("summary", e.target.value)}
            className="h-10 rounded-md border px-3"
          />
          <span className="text-xs text-muted-foreground">{values.summary.length}/160. Required to publish.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Body (Markdown)</span>
          <textarea
            rows={8}
            maxLength={20000}
            value={values.body}
            onChange={(e) => set("body", e.target.value)}
            className="rounded-md border px-3 py-2"
          />
          <span className="text-xs text-muted-foreground">{values.body.length}/20000. Required to publish.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Category</span>
          <select value={values.category} onChange={(e) => set("category", e.target.value as "event" | "update")} className="h-10 rounded-md border px-2">
            <option value="event">Event</option>
            <option value="update">Update</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Start</span>
            <input type="datetime-local" value={values.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="h-10 rounded-md border px-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">End</span>
            <input type="datetime-local" value={values.endsAt} onChange={(e) => set("endsAt", e.target.value)} className="h-10 rounded-md border px-2" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Location</span>
          <input value={values.location} onChange={(e) => set("location", e.target.value)} maxLength={200} className="h-10 rounded-md border px-3" />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={values.isOnline} onChange={(e) => set("isOnline", e.target.checked)} className="h-4 w-4" />
          Online event
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Cover image URL</span>
          <input
            type="url"
            value={values.coverImageUrl}
            onChange={(e) => set("coverImageUrl", e.target.value)}
            placeholder="https://…"
            className="h-10 rounded-md border px-3"
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            Save
          </Button>
          {detail.data.status === "draft" ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError(null);
                publish.mutate({ id });
              }}
            >
              Publish
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError(null);
                unpublish.mutate({ id });
              }}
            >
              Unpublish
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete "${values.title}" permanently?`)) {
                remove.mutate({ id });
              }
            }}
          >
            Delete
          </Button>
        </div>
      </form>

      <EventPreview values={values} />
    </div>
  );
}
