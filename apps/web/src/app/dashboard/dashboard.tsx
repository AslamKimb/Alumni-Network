"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@Alumni-Network/ui/components/button";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

const STEP_NAMES = ["Identity and campus", "Location and work", "Duties and education"];

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const router = useRouter();
  const trpc = useTRPC();
  const status = useQuery(trpc.onboarding.status.queryOptions());
  const isAdmin = session.user.role === "admin";

  if (status.isPending) {
    return <p className="mt-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (status.isError) {
    return (
      <p className="mt-10 text-sm text-destructive">
        We could not load your record. Refresh to try again.
      </p>
    );
  }

  const data = status.data;
  // Admins are not forced through onboarding, so only alumni are gated here.
  if (data && !data.completed && !isAdmin) {
    const step = data.step ?? 1;
    return (
      <div className="max-w-xl">
        <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">
          Finish your profile
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Your record is not complete yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You stopped at step {step} of 3, {STEP_NAMES[step - 1]?.toLowerCase()}. Your saved answers are
          waiting, so you can pick up where you left off.
        </p>
        <Button className="mt-6" onClick={() => router.push("/onboarding")}>
          Resume onboarding
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-3 text-sm text-muted-foreground">Welcome {session.user.name}</p>
      {data && !data.completed && (
        <div className="mt-6 rounded-lg border p-4">
          <p className="text-sm font-medium">Your alumni record is incomplete.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Onboarding is optional for admins, but your record stays hidden from reports until it is
            finished.
          </p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => router.push("/onboarding")}>
            Finish onboarding
          </Button>
        </div>
      )}
    </>
  );
}
