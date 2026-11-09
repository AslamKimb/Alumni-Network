"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@Alumni-Network/ui/components/button";

import { useTRPC, useTRPCClient } from "@/utils/trpc";

import { EventPreview, emptyValues, toInput, type EventFormValues } from "../form-preview";
import { countOccurrences, type RecurrenceFreq } from "../recurrence";

type SeriesClient = {
  createSeries: {
    mutate: (input: {
      title: string;
      summary?: string;
      body?: string;
      category: "event" | "update";
      startsAt?: Date;
      endsAt?: Date;
      location?: string;
      isOnline: boolean;
      coverImageUrl?: string;
      recurrenceFreq: RecurrenceFreq;
      recurrenceInterval: number;
      recurrenceEnd: string;
      exceptionDates: string[];
    }) => Promise<{ id: string }>;
  };
};

export default function EventForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const [values, setValues] = useState<EventFormValues>(emptyValues);
  const [freq, setFreq] = useState<"never" | RecurrenceFreq>("never");
  const [interval, setInterval] = useState(1);
  const [recurrenceEnd, setRecurrenceEnd] = useState("");
  const [exceptionDates, setExceptionDates] = useState<string[]>([]);
  const [exceptionDraft, setExceptionDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation(
    trpc.events.create.mutationOptions({
      onSuccess: (row) => {
        router.push(`/admin/events/${row.id}`);
      },
      onError: (err) => setError(err.message),
    }),
  );
  const seriesClient = trpcClient.events as unknown as SeriesClient;
  const createSeries = useMutation({
    mutationFn: (input: Parameters<SeriesClient["createSeries"]["mutate"]>[0]) =>
      seriesClient.createSeries.mutate(input),
    onSuccess: (row) => router.push(`/admin/events/${row.id}`),
    onError: (err) => setError(err.message),
  });

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const expectedCount =
    freq === "never"
      ? null
      : countOccurrences({
          startsAt: values.startsAt,
          recurrenceFreq: freq,
          recurrenceInterval: interval,
          recurrenceEnd,
          exceptionDates,
        });

  const isSaving = create.isPending || createSeries.isPending;

  return (
    <div className="mt-6 grid gap-8 md:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (freq === "never") {
            create.mutate(toInput(values));
          } else {
            if (!recurrenceEnd) {
              setError("Repeat until is required for recurring events.");
              return;
            }
            createSeries.mutate({ ...toInput(values), recurrenceFreq: freq, recurrenceInterval: interval, recurrenceEnd, exceptionDates });
          }
        }}
        className="space-y-4"
      >
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
          <span className="text-xs text-muted-foreground">{values.body.length}/20000. Required to publish. Links must be http/https; HTML is not rendered.</span>
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

        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Recurrence</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Repeat</span>
              <select value={freq} onChange={(e) => setFreq(e.target.value as "never" | RecurrenceFreq)} className="h-10 rounded-md border px-2">
                <option value="never">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Interval</span>
              <input
                type="number"
                min={1}
                max={100}
                value={interval}
                disabled={freq === "never"}
                onChange={(e) => setInterval(Math.max(1, Number(e.target.value)))}
                className="h-10 rounded-md border px-3 disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Repeat until</span>
              <input
                type="date"
                value={recurrenceEnd}
                disabled={freq === "never"}
                onChange={(e) => setRecurrenceEnd(e.target.value)}
                className="h-10 rounded-md border px-2 disabled:opacity-50"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Exception dates</span>
            <div className="flex gap-2">
              <input
                value={exceptionDraft}
                disabled={freq === "never"}
                onChange={(e) => setExceptionDraft(e.target.value)}
                placeholder="yyyy-mm-dd"
                className="h-10 flex-1 rounded-md border px-3 disabled:opacity-50"
              />
              <Button
                type="button"
                variant="outline"
                disabled={freq === "never" || !/^\d{4}-\d{2}-\d{2}$/.test(exceptionDraft)}
                onClick={() => {
                  setExceptionDates((list) => (list.includes(exceptionDraft) ? list : [...list, exceptionDraft]));
                  setExceptionDraft("");
                }}
              >
                Add
              </Button>
            </div>
            {exceptionDates.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {exceptionDates.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs">
                    {d}
                    <button type="button" aria-label={`Remove ${d}`} onClick={() => setExceptionDates((list) => list.filter((x) => x !== d))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {freq !== "never" && (
            <p className="text-xs text-muted-foreground">
              {expectedCount == null
                ? "Set start and repeat-until to preview occurrence count."
                : `Creates ${expectedCount} occurrence${expectedCount === 1 ? "" : "s"} (exception dates excluded).`}
            </p>
          )}
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save draft"}
        </Button>
      </form>

      <EventPreview values={values} />
    </div>
  );
}
