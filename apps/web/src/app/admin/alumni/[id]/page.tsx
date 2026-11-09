"use client";

import { Button } from "@Alumni-Network/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { hasPermission } from "@Alumni-Network/auth/permissions";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm break-words">{value && value !== "" ? value : "—"}</p>
    </div>
  );
}

export default function AdminAlumniDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());

  const detail = useQuery({
    ...trpc.alumni.getById.queryOptions({ id }),
    enabled:
      (session?.user?.role === "admin" || hasPermission(session?.user ?? {}, "records:view")) &&
      flags.data?.records !== false,
  });

  const onError = (error: { message: string }) => toast.error(error.message);

  const deactivate = useMutation(
    trpc.alumni.deactivate.mutationOptions({
      onSuccess: () => {
        toast.success("Account deactivated");
        queryClient.invalidateQueries({ queryKey: trpc.alumni.getById.queryKey({ id }) });
      },
      onError,
    }),
  );
  const reactivate = useMutation(
    trpc.alumni.reactivate.mutationOptions({
      onSuccess: () => {
        toast.success("Account reactivated");
        queryClient.invalidateQueries({ queryKey: trpc.alumni.getById.queryKey({ id }) });
      },
      onError,
    }),
  );

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

  if (session.user.role !== "admin" && !hasPermission(session.user, "records:view")) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </main>
    );
  }

  if (flags.data?.records === false) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </main>
    );
  }

  if (detail.isPending) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This record was deleted or is not available.
        </p>
        <Link href="/admin/alumni" className="mt-4 inline-block text-sm font-medium underline underline-offset-2">
          Back to alumni records
        </Link>
      </main>
    );
  }

  const { profile, account, duties, education } = detail.data;
  const busy = deactivate.isPending || reactivate.isPending;
  const isActive = !account.deactivatedAt;
  const campusYears =
    profile.campusStartYear != null || profile.campusEndYear != null
      ? `${profile.campusStartYear ?? "—"}–${profile.campusEndYear ?? "—"}`
      : null;
  const location = [profile.city, profile.region, profile.countryName ?? profile.countryCode]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
      <Link href="/admin/alumni" className="text-sm font-medium underline underline-offset-2">
        ← Alumni records
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>{profile.fullName}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.incomplete ? (
              <span className="rounded-sm bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">Incomplete</span>
            ) : null}
            <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${isActive ? "bg-highlight/10 text-highlight" : "bg-muted text-muted-foreground"}`}>
              {isActive ? "Active" : "Deactivated"}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant={isActive ? "destructive" : "outline"}
          disabled={busy}
          onClick={() => (isActive ? deactivate.mutate({ id }) : reactivate.mutate({ id }))}
        >
          {isActive ? "Deactivate" : "Reactivate"}
        </Button>
      </div>

      <section className="mt-8 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Record</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Email" value={account.email} />
          <Field label="Phone" value={profile.phone} />
          <Field label="Campus years" value={campusYears} />
          <Field label="Location" value={location || null} />
          <Field label="Work status" value={profile.workStatus} />
          <Field label="Professional title" value={profile.professionalTitle} />
          <Field label="Employer" value={profile.employer} />
          <Field label="Bio" value={profile.bio} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Duties</h2>
        {duties.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No duties recorded.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {duties.map((duty) => (
              <li key={duty.id} className="py-3">
                <p className="text-sm font-medium">{duty.title} · {duty.organization}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {duty.type} · <span className="font-mono">{duty.startYear}–{duty.endYear ?? "present"}</span>
                </p>
                {duty.description ? <p className="mt-1 text-sm">{duty.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Education</h2>
        {education.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No education recorded.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {education.map((entry) => (
              <li key={entry.id} className="py-3">
                <p className="text-sm font-medium">{entry.program} · {entry.institution}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.level} · <span className="font-mono">{entry.yearCompleted}</span>
                </p>
                {entry.description ? <p className="mt-1 text-sm">{entry.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Email" value={account.email} />
          <Field label="Role" value={account.role} />
          <Field label="Signed up" value={account.createdAt ? new Date(account.createdAt).toLocaleDateString() : null} />
          <Field
            label="Last active"
            value={account.lastActiveAt ? new Date(account.lastActiveAt).toLocaleString() : null}
          />
          <Field label="Status" value={isActive ? "Active" : "Deactivated"} />
        </div>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Admins cannot edit alumnus-entered fields. To correct this record, contact the alumnus.
      </p>
    </main>
  );
}
