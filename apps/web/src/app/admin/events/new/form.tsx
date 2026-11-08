"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@Alumni-Network/ui/components/button";

import { useTRPC } from "@/utils/trpc";

import { EventPreview, emptyValues, toInput, type EventFormValues } from "../form-preview";

export default function EventForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const [values, setValues] = useState<EventFormValues>(emptyValues);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation(
    trpc.events.create.mutationOptions({
      onSuccess: (row) => {
        router.push(`/admin/events/${row.id}`);
      },
      onError: (err) => setError(err.message),
    }),
  );

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  return (
    <div className="mt-6 grid gap-8 md:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          create.mutate(toInput(values));
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save draft"}
        </Button>
      </form>

      <EventPreview values={values} />
    </div>
  );
}
