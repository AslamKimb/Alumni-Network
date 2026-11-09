"use client";

import { hasPermission } from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";
import { Checkbox } from "@Alumni-Network/ui/components/checkbox";
import { Input } from "@Alumni-Network/ui/components/input";
import { Label } from "@Alumni-Network/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

const MODULE = "reports" as const;
const BOOL_FIELDS = [
  { field: "moduleEnabled", label: "Enable reports module", helper: "When off, the reports navigation is hidden and report routes return not-found. Data is retained." },
  { field: "exportEnabled", label: "Allow CSV export", helper: "Enables both report CSV buttons and endpoints." },
];
const NUM_FIELD = { field: "topN", label: "Top N", helper: "Number of bars or slices before grouping into Other (1–100).", min: 1, max: 100 };

export default function AdminReportsSettingsPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) router.replace("/login");
    else if (session.user.role !== "admin" && !hasPermission(session.user, "settings:manage")) router.replace("/dashboard");
  }, [isPending, session, router]);

  if (isPending || !session?.user || (session.user.role !== "admin" && !hasPermission(session.user, "settings:manage"))) {
    return <p className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 text-sm text-muted-foreground md:px-6">Loading…</p>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
      <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">Admin</p>
      <h1 className="mt-2">Reports</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">Reports module settings. Saved as one section.</p>
      <ModuleForm title="Reports settings" />
    </main>
  );
}

function ModuleForm({ title }: { title: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const settings = useQuery(trpc.settings.getModuleSettings.queryOptions({ module: MODULE }));
  const [values, setValues] = useState<Record<string, boolean | number> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (settings.data && !values) setValues(settings.data);
  }, [settings.data, values]);

  const save = useMutation(
    trpc.settings.saveModuleSettings.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.settings.getModuleSettings.queryKey({ module: MODULE }), data);
        setValues(data);
        setError("");
        toast.success(`${title} saved`);
      },
      onError: (err) => {
        setError(err.message);
        toast.error(err.message);
      },
    }),
  );

  if (settings.isPending) return <p className="mt-10 text-sm text-muted-foreground">Loading settings…</p>;
  if (!values) return <p className="mt-10 text-sm text-error-text">Could not load settings.</p>;

  return (
    <form
      className="mt-8 space-y-6 rounded-lg border bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const v = values[NUM_FIELD.field];
        if (typeof v !== "number" || !Number.isInteger(v) || v < NUM_FIELD.min || v > NUM_FIELD.max) {
          setError(`${NUM_FIELD.label} must be a whole number between ${NUM_FIELD.min} and ${NUM_FIELD.max}.`);
          return;
        }
        save.mutate({ module: MODULE, values });
      }}
    >
      {error ? <p className="text-sm text-error-text">{error}</p> : null}
      {BOOL_FIELDS.map((f) => (
        <div key={f.field} className="flex items-start gap-3">
          <Checkbox id={f.field} checked={values[f.field] === true} onCheckedChange={(c) => setValues({ ...values, [f.field]: c === true })} />
          <div className="space-y-0.5">
            <Label htmlFor={f.field}>{f.label}</Label>
            <p className="text-xs text-muted-foreground">{f.helper}</p>
          </div>
        </div>
      ))}
      <div className="space-y-1.5">
        <Label htmlFor={NUM_FIELD.field}>{NUM_FIELD.label}</Label>
        <Input
          id={NUM_FIELD.field}
          type="number"
          min={NUM_FIELD.min}
          max={NUM_FIELD.max}
          step={1}
          value={String(values[NUM_FIELD.field] ?? "")}
          onChange={(e) => setValues({ ...values, [NUM_FIELD.field]: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">{NUM_FIELD.helper}</p>
      </div>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : `Save ${title.toLowerCase()}`}
      </Button>
    </form>
  );
}
