"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { AudienceBadge, CohortCard } from "@/components/cohorts";
import { ShareButtons, absoluteUrl } from "@/components/share-buttons";
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
  const myCohort = useQuery(trpc.cohorts.getMyCohort.queryOptions());
  const announcements = useQuery(trpc.announcements.listPublished.queryOptions());

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
  const relatedAnnouncement = event.relatedAnnouncementId
    ? (announcements.data ?? []).find((a) => a.id === event.relatedAnnouncementId)
    : undefined;

  return (
    <article>
      {event.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverImageUrl} alt="" className="w-full rounded-lg object-cover" />
      )}
      <span className="mt-4 inline-flex rounded-sm bg-secondary px-3 py-1 text-xs font-medium tracking-[0.5px] uppercase">
        {event.category}
      </span>
      <div className="mt-2">
        <AudienceBadge
          audience={event.audience}
          myCohortId={myCohort.data?.cohort?.id ?? null}
          myCohortName={myCohort.data?.cohort?.name ?? null}
        />
      </div>
      <CohortCard />
      <h1 className="mt-2">{event.title}</h1>
      <div className="mt-3">
        <ShareButtons url={absoluteUrl(`/events/${event.id}`)} title={event.title} />
      </div>
      <dl className="mt-3 flex min-w-0 flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
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
      {event.summary && <p className="mt-4 break-words text-base text-muted-foreground">{event.summary}</p>}
      <div className="mt-6 space-y-4 break-words">{event.body ? renderMarkdown(event.body) : null}</div>
      {relatedAnnouncement && (
        <div className="mt-8 rounded-lg border bg-card p-4" aria-label="Related announcement">
          <p className="text-xs font-semibold uppercase tracking-[0.5px] text-muted-foreground">Related announcement</p>
          <Link
            href={`/announcements/${relatedAnnouncement.id}`}
            className="mt-1 block text-base font-semibold text-highlight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {relatedAnnouncement.title}
          </Link>
        </div>
      )}
    </article>
  );
}
