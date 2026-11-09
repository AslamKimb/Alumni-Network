"use client";
import { Button } from "@Alumni-Network/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

const highlights = [
  {
    title: "Keep your record current",
    body: "Update your campus years, location, work, and education from one profile.",
  },
  {
    title: "Hear from your institution",
    body: "Read events and updates published by the alumni office.",
  },
  {
    title: "Private by design",
    body: "Your record is visible to administrators only, never to other alumni.",
  },
];

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const trpc = useTRPC();
  const org = useQuery(trpc.settings.getOrganization.queryOptions());

  useEffect(() => {
    if (session) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  if (isPending || session) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16 md:px-6 md:py-24">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const orgName = org.data?.name?.trim() || "Alumni Network";
  const description = org.data?.description?.trim() || "";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-16 md:px-6 md:py-24">
      <div className="max-w-2xl">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight break-words">
          {orgName}
        </p>
        <h1 className="mt-4 text-display">Your alumni record, in one place.</h1>
        <p className="mt-6 max-w-xl text-lg/relaxed text-muted-foreground break-words">
          {description ||
            "A private registry for your institution. Create an account, complete your profile, and keep the alumni office up to date with where you are and what you do."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/login?mode=signup" />}>
            Create your account
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login?mode=signin" />}>
            Sign in
          </Button>
        </div>
      </div>

      <ul className="mt-16 grid gap-6 border-t pt-10 sm:grid-cols-3">
        {highlights.map(({ title, body }) => (
          <li key={title}>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-2 text-sm/relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
