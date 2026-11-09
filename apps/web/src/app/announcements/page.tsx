"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

function CoverImg({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="aspect-[16/9] w-full rounded-md object-cover" onError={() => setBroken(true)} />
  );
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const published = useQuery(trpc.announcements.listPublished.queryOptions());
  const myCohort = useQuery(trpc.cohorts.getMyCohort.queryOptions());

  const markRead = useMutation(
    trpc.announcements.markRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.announcements.unreadCount.queryKey() });
      },
    }),
  );

  useEffect(() => {
    if (!sessionPending && !!session?.user) {
      markRead.mutate();
    }
    // Fire-and-forget on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPending, !!session?.user]);

  if (sessionPending) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!session?.user) {
    router.replace("/login");
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
        Alumni Network
      </p>
      <h1 className="mt-2">Announcements</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        News and updates from the alumni office.
      </p>
      <CohortCard />

      {published.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : published.isError || !published.data ? (
        <p className="mt-8 text-sm text-muted-foreground">Could not load announcements.</p>
      ) : published.data.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {published.data.map((item) => (
            <div key={item.id} className="rounded-lg border bg-card p-4">
              <Link
                href={`/announcements/${item.id}`}
                className="block transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {item.coverImageUrl && <CoverImg src={item.coverImageUrl} />}
                <h3 className="mt-2 break-words text-base font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{fmtDate(item.publishedAt)}</p>
                <div className="mt-2">
                  <AudienceBadge
                    audience={item.audience}
                    myCohortId={myCohort.data?.cohort?.id ?? null}
                    myCohortName={myCohort.data?.cohort?.name ?? null}
                  />
                </div>
                {item.body && (
                  <p className="mt-2 line-clamp-3 break-words text-sm text-muted-foreground">{item.body}</p>
                )}
              </Link>
              <div className="mt-3">
                <ShareButtons url={absoluteUrl(`/announcements/${item.id}`)} title={item.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
