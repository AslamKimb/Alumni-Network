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

const MODULE = "profile" as const;

type BoolField = { field: string; label: string; helper: string; kind: "bool" };
type NumField = { field: string; label: string; helper: string; kind: "num"; min: number; max: number };
const FIELDS: (BoolField | NumField)[] = [
  { field: "allowEdits", label: "Allow profile edits", helper: "When off, the editor is read-only after onboarding; onboarding itself is never blocked.", kind: "bool" },
  { field: "maxDuties", label: "Maximum duty entries", helper: "Maximum duty entries per alumnus (0–100).", kind: "num", min: 0, max: 100 },
  { field: "maxEducation", label: "Maximum education entries", helper: "Maximum education entries per alumnus (0–100).", kind: "num", min: 0, max: 100 },
  { field: "allowAccountDeletion", label: "Allow account deletion", helper: "Shows or hides the account-deletion action.", kind: "bool" },
];

export default function AdminProfileSettingsPage() {
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
      <h1 className="mt-2">Profile</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Rules for alumnus records. Saved as one section.
      </p>
      <ModuleForm title="Profile settings" />
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
        for (const f of FIELDS) {
          if (f.kind === "num") {
            const v = values[f.field];
            if (typeof v !== "number" || !Number.isInteger(v) || v < f.min || v > f.max) {
              setError(`${f.label} must be a whole number between ${f.min} and ${f.max}.`);
              return;
            }
          }
        }
        save.mutate({ module: MODULE, values });
      }}
    >
      {error ? <p className="text-sm text-error-text">{error}</p> : null}
      {FIELDS.map((f) =>
        f.kind === "bool" ? (
          <div key={f.field} className="flex items-start gap-3">
            <Checkbox id={f.field} checked={values[f.field] === true} onCheckedChange={(c) => setValues({ ...values, [f.field]: c === true })} />
            <div className="space-y-0.5">
              <Label htmlFor={f.field}>{f.label}</Label>
              <p className="text-xs text-muted-foreground">{f.helper}</p>
            </div>
          </div>
        ) : (
          <div key={f.field} className="space-y-1.5">
            <Label htmlFor={f.field}>{f.label}</Label>
            <Input
              id={f.field}
              type="number"
              min={f.min}
              max={f.max}
              step={1}
              value={String(values[f.field] ?? "")}
              onChange={(e) => setValues({ ...values, [f.field]: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">{f.helper}</p>
          </div>
        ),
      )}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : `Save ${title.toLowerCase()}`}
      </Button>
    </form>
  );
}
