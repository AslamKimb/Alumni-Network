"use client";

import { hasPermission } from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";
import { Checkbox } from "@Alumni-Network/ui/components/checkbox";
import { Label } from "@Alumni-Network/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

const MODULE = "events" as const;
const FIELDS = [
  { field: "moduleEnabled", label: "Enable events module", helper: "When off, the events navigation is hidden and event routes return not-found. Data is retained." },
  { field: "showPastEvents", label: "Show past events", helper: "Shows the Past tab on the alumni event list." },
];

export default function AdminEventsSettingsPage() {
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
      <h1 className="mt-2">Events</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">Events and updates module settings. Saved as one section.</p>
      <ModuleForm title="Events settings" />
    </main>
  );
}

function ModuleForm({ title }: { title: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const settings = useQuery(trpc.settings.getModuleSettings.queryOptions({ module: MODULE }));
  const [values, setValues] = useState<Record<string, boolean | number> | null>(null);

  useEffect(() => {
    if (settings.data && !values) setValues(settings.data);
  }, [settings.data, values]);

  if (settings.isPending) return <p className="mt-10 text-sm text-muted-foreground">Loading settings…</p>;
  if (!values) return <p className="mt-10 text-sm text-destructive">Could not load settings.</p>;

  const save = useMutation(
    trpc.settings.saveModuleSettings.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.settings.getModuleSettings.queryKey({ module: MODULE }), data);
        setValues(data);
        toast.success(`${title} saved`);
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <form
      className="mt-8 space-y-6 rounded-lg border bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ module: MODULE, values });
      }}
    >
      {FIELDS.map((f) => (
        <div key={f.field} className="flex items-start gap-3">
          <Checkbox id={f.field} checked={values[f.field] === true} onCheckedChange={(c) => setValues({ ...values, [f.field]: c === true })} />
          <div className="space-y-0.5">
            <Label htmlFor={f.field}>{f.label}</Label>
            <p className="text-xs text-muted-foreground">{f.helper}</p>
          </div>
        </div>
      ))}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : `Save ${title.toLowerCase()}`}
      </Button>
    </form>
  );
}
