"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export default function AnnouncementsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const published = useQuery(trpc.announcements.listPublished.queryOptions());

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
      <h1 className="mt-2 text-2xl font-semibold">Announcements</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        News and updates from the alumni office.
      </p>

      {published.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : published.isError || !published.data ? (
        <p className="mt-8 text-sm text-muted-foreground">Could not load announcements.</p>
      ) : published.data.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {published.data.map((item) => (
            <Link
              key={item.id}
              href={`/announcements/${item.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/60"
            >
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{fmtDate(item.publishedAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
