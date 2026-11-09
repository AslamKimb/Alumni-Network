"use client";

import { hasPermission } from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

type Cohort = {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  socialUrl: string | null;
};

export default function AdminCohortsPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cohorts = useQuery({
    ...trpc.cohorts.list.queryOptions(),
    enabled: !isPending && !!session?.user,
  });

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) router.replace("/login");
    else if (session.user.role !== "admin" && !hasPermission(session.user, "settings:manage")) router.replace("/dashboard");
  }, [isPending, session, router]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.cohorts.list.queryKey() });
  const onError = (err: { message: string }) => {
    setError(err.message);
    toast.error(err.message);
  };
  const resetForm = () => {
    setEditingId(null);
    setName("");
    setStartYear("");
    setEndYear("");
    setSocialUrl("");
    setError(null);
  };

  const create = useMutation(
    trpc.cohorts.create.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Cohort created");
        setShowForm(false);
        resetForm();
      },
      onError,
    }),
  );
  const update = useMutation(
    trpc.cohorts.update.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Cohort saved");
        setShowForm(false);
        resetForm();
      },
      onError,
    }),
  );
  const remove = useMutation(
    trpc.cohorts.delete.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Cohort deleted");
        setShowForm(false);
        resetForm();
      },
      onError,
    }),
  );
  const busy = create.isPending || update.isPending || remove.isPending;

  const allowed =
    !!session?.user && (session.user.role === "admin" || hasPermission(session.user, "settings:manage"));

  if (isPending || !allowed) {
    return <p className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 text-sm text-muted-foreground md:px-6">Loading…</p>;
  }

  const yearsValid =
    Number.isInteger(Number(startYear)) && Number.isInteger(Number(endYear)) && Number(endYear) >= Number(startYear);
  const socialValid =
    socialUrl.trim() === "" || socialUrl.trim().startsWith("https://");

  const openEdit = (c: Cohort) => {
    setEditingId(c.id);
    setName(c.name);
    setStartYear(String(c.startYear));
    setEndYear(String(c.endYear));
    setSocialUrl(c.socialUrl ?? "");
    setError(null);
    setShowForm(true);
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">Admin</p>
      <h1 className="mt-2">Cohorts</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Year ranges that group alumni. Ranges cannot overlap. Alumni whose campus end year falls in a range belong to
        that cohort.
      </p>

      <div className="mt-6">
        <Button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm((v) => !v);
          }}
        >
          New cohort
        </Button>
      </div>

      {showForm && (
        <form
          className="mt-6 space-y-4 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!yearsValid) {
              setError("Enter valid start and end years (end year must be at least the start year).");
              return;
            }
            if (!socialValid) {
              setError("Social link must start with https://");
              return;
            }
            const payload = {
              name: name.trim(),
              startYear: Number(startYear),
              endYear: Number(endYear),
              socialUrl: socialUrl.trim() || null,
            };
            if (editingId) update.mutate({ id: editingId, ...payload });
            else create.mutate(payload);
          }}
        >
          <p className="text-sm font-medium">{editingId ? "Edit cohort" : "New cohort"}</p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Name</span>
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full min-w-0 rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Start year</span>
              <input
                required
                type="number"
                inputMode="numeric"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                className="h-10 w-full min-w-0 rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">End year</span>
              <input
                required
                type="number"
                inputMode="numeric"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                className="h-10 w-full min-w-0 rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Social link (optional)</span>
            <input
              type="url"
              value={socialUrl}
              onChange={(e) => setSocialUrl(e.target.value)}
              placeholder="https://wa.me/… or another HTTPS link"
              className="h-10 w-full min-w-0 rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10"
            />
            <span className="text-xs text-muted-foreground">HTTPS links only, e.g. a wa.me group invite.</span>
          </label>
          {error && <p className="text-sm text-error-text">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {editingId ? "Save" : "Create cohort"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete cohort "${name}" permanently?`)) remove.mutate({ id: editingId });
                }}
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {cohorts.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : cohorts.isError || !cohorts.data ? (
        <p className="mt-8 text-sm text-error-text">Could not load cohorts.</p>
      ) : cohorts.data.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No cohorts yet.</p>
      ) : (
        <div className="mt-6 max-w-full overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Name</th>
                <th scope="col" className="px-4 py-2 font-medium">Years</th>
                <th scope="col" className="px-4 py-2 font-medium">Social link</th>
                <th scope="col" className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.data.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 font-mono">
                    {c.startYear}–{c.endYear}
                  </td>
                  <td className="px-4 py-2">
                    {c.socialUrl ? (
                      <a
                        href={c.socialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-highlight underline-offset-2 hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
