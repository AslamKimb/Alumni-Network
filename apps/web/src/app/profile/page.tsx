"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { COUNTRIES } from "@Alumni-Network/api/countries";
import { Button } from "@Alumni-Network/ui/components/button";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() ?? "?";
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

const DUTY_GROUP_ORDER: Array<{ type: string; label: string }> = [
  { type: "religious", label: "Religious" },
  { type: "political", label: "Political" },
  { type: "other", label: "Other" },
];

const EDUCATION_LABELS: Record<string, string> = {
  secondary: "Secondary",
  certificate: "Certificate",
  diploma: "Diploma",
  bachelor: "Bachelor",
  master: "Master",
  doctorate: "Doctorate",
  other: "Other",
};

export default function ProfilePage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

  useEffect(() => {
    if (!sessionPending && !session?.user) router.replace("/login");
  }, [session, sessionPending, router]);

  if (sessionPending || profileQuery.isPending) return <p className="text-sm text-muted-foreground">Loading your profile…</p>;
  if (!session?.user) return null;
  if (profileQuery.isError) return <p className="text-sm text-destructive">We could not load your profile. Refresh to try again.</p>;

  const data = profileQuery.data;
  if (!data?.profile) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="mt-3 text-sm text-muted-foreground">You have no alumni record yet. Finish onboarding to build one.</p>
        <Button className="mt-6" onClick={() => router.push("/onboarding")}>Go to onboarding</Button>
      </div>
    );
  }

  const profile = data.profile;
  const { percent, missing } = data.completeness;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground" aria-hidden="true">
            {initials(profile.fullName)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{profile.fullName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{profile.professionalTitle ?? "No professional title"}</p>
            <p className="mt-1 text-sm">{[profile.city, profile.region, countryName(profile.countryCode)].filter((v, i, a) => v && v !== "Not set" || (i === 2 && profile.countryCode)).join(", ") || "No location"}</p>
          </div>
        </div>
        <Button onClick={() => router.push("/settings/profile")}>Edit profile</Button>
      </div>

      <section className="mt-6 rounded-lg border p-4" aria-label="Profile completeness">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium">Completeness</p>
          <p className="font-mono text-sm">{percent}%</p>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 rounded-full bg-highlight" style={{ width: `${percent}%` }} />
        </div>
        {missing.length > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Missing: {missing.join(", ")}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">All required fields are filled.</p>
        )}
      </section>

      <section className="mt-6 grid gap-4 rounded-lg border p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Campus years</p>
          <p className="mt-1 text-sm"><span className="font-mono">{profile.campusStartYear ?? "—"}–{profile.campusEndYear ?? "—"}</span></p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Work status</p>
          <p className="mt-1 text-sm">{workStatusLabel(profile.workStatus)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Location</p>
          <p className="mt-1 text-sm">{profile.city ?? "—"}{profile.region ? `, ${profile.region}` : ""}, {countryName(profile.countryCode)}</p>
        </div>
        {profile.employer && (
          <div>
            <p className="text-xs text-muted-foreground">Employer</p>
            <p className="mt-1 text-sm">{profile.employer}</p>
          </div>
        )}
        {profile.phone && (
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="mt-1 text-sm">{profile.phone}</p>
          </div>
        )}
      </section>

      {profile.bio && (
        <section className="mt-6 rounded-lg border p-6">
          <h2 className="text-sm font-semibold">Bio</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{profile.bio}</p>
        </section>
      )}

      <section className="mt-6 rounded-lg border p-6">
        <h2 className="text-sm font-semibold">Duties</h2>
        {data.duties.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No duties recorded.</p>}
        {DUTY_GROUP_ORDER.map((group) => {
          const items = data.duties.filter((d) => d.type === group.type);
          if (items.length === 0) return null;
          return (
            <div key={group.type} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.5px]">{group.label}</p>
              <ul className="mt-2 space-y-3">
                {items.map((d) => (
                  <li key={d.id} className="rounded-md border p-4">
                    <p className="text-sm font-medium">{d.title} — {d.organization}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{d.startYear}–{d.endYear ?? "Ongoing"}</p>
                    {d.description && <p className="mt-1 whitespace-pre-wrap text-sm">{d.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="mt-6 rounded-lg border p-6">
        <h2 className="text-sm font-semibold">Education</h2>
        {data.education.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No education recorded.</p>}
        <ul className="mt-2 space-y-3">
          {data.education.map((e) => (
            <li key={e.id} className="rounded-md border p-4">
              <p className="text-sm font-medium">{EDUCATION_LABELS[e.level] ?? e.level}: {e.program} — {e.institution}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">Completed {e.yearCompleted}</p>
              {e.description && <p className="mt-1 whitespace-pre-wrap text-sm">{e.description}</p>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
