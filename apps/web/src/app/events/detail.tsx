"use client";

import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

import { renderMarkdown } from "./markdown";

function fmt(date: Date | string | null) {
  if (!date) return "TBA";
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventsDetail({ id }: { id: string }) {
  const trpc = useTRPC();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());
  const detail = useQuery({
    ...trpc.events.getPublishedById.queryOptions({ id }),
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
  if (detail.isPending) return <p className="mt-10 text-sm text-muted-foreground">Loading…</p>;
  if (detail.isError || !detail.data) {
    // Drafts and missing events look identical to alumni: not-found.
    notFound();
    return null;
  }

  const event = detail.data;

  return (
    <article>
      {event.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverImageUrl} alt="" className="w-full rounded-lg object-cover" />
      )}
      <span className="mt-4 inline-flex rounded-sm bg-secondary px-3 py-1 text-xs font-medium tracking-[0.5px] uppercase">
        {event.category}
      </span>
      <h1 className="mt-2 text-2xl font-semibold">{event.title}</h1>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <dt>Starts</dt>
          <dd>{fmt(event.startsAt)}</dd>
        </div>
        {event.endsAt && (
          <div className="flex gap-2">
            <dt>Ends</dt>
            <dd>{fmt(event.endsAt)}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt>Where</dt>
          <dd>{event.isOnline ? "Online" : (event.location ?? "Online")}</dd>
        </div>
      </dl>
      {event.summary && <p className="mt-4 text-base text-muted-foreground">{event.summary}</p>}
      <div className="mt-6 space-y-4">{event.body ? renderMarkdown(event.body) : null}</div>
    </article>
  );
}
