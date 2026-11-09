"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

/** Audience picker: "all" + each cohort. Requires cohorts list (admin). */
export function AudienceSelect({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const trpc = useTRPC();
  const cohorts = useQuery(trpc.cohorts.list.queryOptions());
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Audience{required ? " (required)" : ""}</span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full min-w-0 rounded-md border px-2 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
      >
        <option value="all">All alumni</option>
        {(cohorts.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            Only {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** "Your cohort" card with social link, shown when the viewer has a cohort. */
export function CohortCard() {
  const trpc = useTRPC();
  const mine = useQuery(trpc.cohorts.getMyCohort.queryOptions());
  const cohort = mine.data?.cohort ?? null;
  if (mine.isPending || mine.isError || !cohort) return null;
  return (
    <div className="mt-6 rounded-lg border bg-card p-4" aria-label="Your cohort">
      <p className="text-xs font-semibold uppercase tracking-[0.5px] text-muted-foreground">Your cohort</p>
      <p className="mt-1 text-sm font-medium">
        {cohort.name} <span className="font-mono text-muted-foreground">({cohort.startYear}–{cohort.endYear})</span>
      </p>
      {cohort.socialUrl ? (
        <a
          href={cohort.socialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm font-medium text-highlight underline-offset-4 hover:underline"
        >
          Join your cohort group
        </a>
      ) : null}
    </div>
  );
}

/** Badge for a targeted item; items are pre-filtered server-side. */
export function AudienceBadge({
  audience,
  myCohortId,
  myCohortName,
}: {
  audience: string | null | undefined;
  myCohortId?: string | null;
  myCohortName?: string | null;
}) {
  if (!audience || audience === "all") return null;
  const label = audience === myCohortId ? `For ${myCohortName ?? "your cohort"}` : "For your cohort";
  return (
    <span className="inline-flex rounded-sm bg-highlight/10 px-2 py-0.5 text-xs font-medium text-highlight">
      {label}
    </span>
  );
}
