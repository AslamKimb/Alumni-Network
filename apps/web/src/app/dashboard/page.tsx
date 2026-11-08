"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { COUNTRIES } from "@Alumni-Network/api/countries";
import { hasPermission } from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

const STEP_NAMES = ["Identity and campus", "Location and work", "Duties and education"];

function firstName(fullName: string | null | undefined, fallback: string) {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || fallback;
}

function countryName(code: string | null) {
  if (!code) return "Not set";
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

function workStatusLabel(status: string | null) {
  switch (status) {
    case "employed":
      return "Employed";
    case "self_employed":
      return "Self-employed";
    case "student":
      return "Student";
    case "unemployed":
      return "Unemployed";
    case "retired":
      return "Retired";
    case "other":
      return "Other";
    default:
      return "Not set";
  }
}

function fmtDate(value: Date | string | null) {
  if (!value) return "TBA";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const status = useQuery(trpc.onboarding.status.queryOptions());
  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());
  const eventsQuery = useQuery(trpc.events.listPublished.queryOptions());

  useEffect(() => {
    if (!sessionPending && !session?.user) router.replace("/login");
  }, [session, sessionPending, router]);

  if (sessionPending || status.isPending || profileQuery.isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!session?.user) return null;

  if (status.isError || profileQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-6">
        <p className="text-sm text-destructive">
          We could not load your record. Refresh to try again.
        </p>
      </main>
    );
  }

  const isAdmin = session.user.role === "admin";
  const canManageEvents = hasPermission(session.user, "events:manage");
  const canViewRecords = hasPermission(session.user, "records:view");
  const canViewReports = hasPermission(session.user, "reports:view");
  const data = status.data;

  // Admins are not forced through onboarding, so only alumni are gated here.
  if (data && !data.completed && !isAdmin) {
    const step = data.step ?? 1;
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-6">
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
      </main>
    );
  }

  const profileData = profileQuery.data;
  const profile = profileData?.profile ?? null;
  const completeness = profileData?.completeness ?? { percent: 0, missing: [] };
  const onboardingCompleted = profileData?.onboardingCompleted ?? false;
  const name = firstName(profile?.fullName, session.user.name);

  const latestEvents = eventsQuery.data
    ? [...eventsQuery.data.upcoming, ...eventsQuery.data.past]
        .sort((a, b) => new Date(b.startsAt ?? 0).getTime() - new Date(a.startsAt ?? 0).getTime())
        .slice(0, 3)
    : [];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16 md:px-6">
      <h1 className="text-2xl font-semibold">Welcome, {name}</h1>

      {!profile ? (
        <div className="mt-6 max-w-xl rounded-lg border p-4">
          <p className="text-sm font-medium">You have no alumni record yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Finish onboarding to build your record.
          </p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => router.push("/onboarding")}>
            Go to onboarding
          </Button>
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-lg border p-6" aria-label="Your record">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Professional title</p>
                <p className="mt-1 text-sm">{profile.professionalTitle ?? "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="mt-1 text-sm">
                  {[profile.city, countryName(profile.countryCode)]
                    .filter((v) => v && v !== "Not set")
                    .join(", ") || "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Campus years</p>
                <p className="mt-1 text-sm">
                  <span className="font-mono">
                    {profile.campusStartYear ?? "—"}–{profile.campusEndYear ?? "—"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Work status</p>
                <p className="mt-1 text-sm">{workStatusLabel(profile.workStatus)}</p>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-lg border p-4" aria-label="Record status">
            {completeness.percent === 100 ? (
              <p className="text-sm font-medium">Your record is complete (100%).</p>
            ) : (
              <>
                <p className="text-sm font-medium">Your record is {completeness.percent}% complete.</p>
                {completeness.missing.length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Missing: {completeness.missing.join(", ")}
                  </p>
                )}
              </>
            )}
            {!onboardingCompleted && (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">
                  Onboarding is optional for admins, but your record stays hidden from reports until it is
                  finished.
                </p>
                <Button className="mt-4" size="sm" variant="outline" onClick={() => router.push("/onboarding")}>
                  Finish onboarding
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      <section className="mt-6" aria-label="Latest updates">
        <h2 className="text-base font-semibold">Latest updates</h2>
        {eventsQuery.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : eventsQuery.isError ? (
          <p className="mt-3 text-sm text-muted-foreground">Could not load events.</p>
        ) : latestEvents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No updates yet</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestEvents.map((item) => (
              <Link
                key={item.id}
                href={`/events/${item.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/60"
              >
                <span className="inline-flex rounded-sm bg-secondary px-3 py-1 text-xs font-medium tracking-[0.5px] uppercase">
                  {item.category}
                </span>
                <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fmtDate(item.startsAt)} · {item.isOnline ? "Online" : (item.location ?? "Online")}
                </p>
              </Link>
            ))}
          </div>
        )}
        <Link href="/events" className="mt-4 inline-block text-sm font-medium text-highlight underline-offset-4 hover:underline">
          View all events
        </Link>
      </section>

      <section className="mt-6" aria-label="Quick actions">
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/profile" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Edit profile
          </Link>
          <Link href="/events" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium">
            View events
          </Link>
          <Link href="/settings/account" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium">
            Settings
          </Link>
        </div>
      </section>

      {(canManageEvents || canViewRecords || canViewReports) && (
        <section className="mt-6" aria-label="Admin">
          <h2 className="text-base font-semibold">Admin</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {canViewRecords && (
              <Link href="/admin/alumni" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium">
                Alumni Records
              </Link>
            )}
            {canViewReports && (
              /* Plain anchor: /admin/reports is not a typed route yet (module not started). */
              <a href="/admin/reports" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium">
                Reports
              </a>
            )}
            {canManageEvents && (
              <Link href="/admin/events" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium">
                Event management
              </Link>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
