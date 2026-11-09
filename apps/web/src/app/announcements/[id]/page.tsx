"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AudienceBadge, CohortCard } from "@/components/cohorts";
import { ShareButtons, absoluteUrl } from "@/components/share-buttons";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [coverBroken, setCoverBroken] = useState(false);
  const detail = useQuery(trpc.announcements.getPublishedById.queryOptions({ id }));
  const myCohort = useQuery(trpc.cohorts.getMyCohort.queryOptions());
  const events = useQuery(trpc.events.listPublished.queryOptions());

  const relatedEvent = detail.data?.relatedEventId
    ? [...(events.data?.upcoming ?? []), ...(events.data?.past ?? [])].find(
        (e) => e.id === detail.data.relatedEventId,
      )
    : undefined;

  if (sessionPending) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!session?.user) {
    router.replace("/login");
    return null;
  }

  if (detail.isPending) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
      <article>
        {detail.data.coverImageUrl && !coverBroken && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.data.coverImageUrl}
            alt=""
            className="w-full rounded-lg object-cover"
            onError={() => setCoverBroken(true)}
          />
        )}
        <h1 className="mt-4">{detail.data.title}</h1>
        <div className="mt-3">
          <ShareButtons url={absoluteUrl(`/announcements/${detail.data.id}`)} title={detail.data.title} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{fmtDate(detail.data.publishedAt)}</p>
        <div className="mt-2">
          <AudienceBadge
            audience={detail.data.audience}
            myCohortId={myCohort.data?.cohort?.id ?? null}
            myCohortName={myCohort.data?.cohort?.name ?? null}
          />
        </div>
        <CohortCard />
        {detail.data.body && (
          <p className="mt-6 break-words whitespace-pre-wrap text-base leading-relaxed">{detail.data.body}</p>
        )}
        {relatedEvent && (
          <div className="mt-8 rounded-lg border bg-card p-4" aria-label="Related event">
            <p className="text-xs font-semibold uppercase tracking-[0.5px] text-muted-foreground">Related event</p>
            <Link
              href={`/events/${relatedEvent.id}`}
              className="mt-1 block text-base font-semibold text-highlight underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {relatedEvent.title}
            </Link>
          </div>
        )}
      </article>
    </main>
  );
}
