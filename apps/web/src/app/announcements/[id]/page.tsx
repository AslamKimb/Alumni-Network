"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

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
  const detail = useQuery(trpc.announcements.getPublishedById.queryOptions({ id }));

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
        <h1 className="text-2xl font-semibold">{detail.data.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{fmtDate(detail.data.publishedAt)}</p>
        {detail.data.body && (
          <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed">{detail.data.body}</p>
        )}
      </article>
    </main>
  );
}
