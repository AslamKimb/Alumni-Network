"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@Alumni-Network/ui/components/button";

import { useTRPC } from "@/utils/trpc";

import { EventPreview, toInput, type EventFormValues } from "../form-preview";

function toLocalInput(date: Date | string | null) {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventForm({ id }: { id: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<EventFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.events.getById.queryKey() });
  const onError = (err: { message: string }) => setError(err.message);

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

  if (detail.isPending || !values) return <p className="mt-10 text-sm text-muted-foreground">Loading…</p>;
  if (detail.isError || !detail.data) {
    notFound();
    return null;
  }

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((v) => (v ? { ...v, [key]: value } : v));

  const busy = update.isPending || publish.isPending || unpublish.isPending || remove.isPending;

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
