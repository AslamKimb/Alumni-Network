"use client";

import { Button } from "@Alumni-Network/ui/components/button";
import { Checkbox } from "@Alumni-Network/ui/components/checkbox";
import { Input } from "@Alumni-Network/ui/components/input";
import { Label } from "@Alumni-Network/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

type AuthSettingsValues = {
  signupsOpen: boolean;
  allowedEmailDomains: string[];
};

export default function AuthSettings() {
  const trpc = useTRPC();
  const settings = useQuery(trpc.settings.auth.queryOptions());

  if (settings.isPending) {
    return <p className="mt-10 text-sm text-muted-foreground">Loading settings…</p>;
  }

  if (!settings.data) {
    return <p className="mt-10 text-sm text-error-text">Could not load settings.</p>;
  }

  return <AuthSettingsForm initial={settings.data} />;
}

function AuthSettingsForm({ initial }: { initial: AuthSettingsValues }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [signupsOpen, setSignupsOpen] = useState(initial.signupsOpen);
  const [domains, setDomains] = useState(initial.allowedEmailDomains.join(", "));

  const save = useMutation(
    trpc.settings.updateAuth.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(trpc.settings.auth.queryKey(), data);
        setDomains(data.allowedEmailDomains.join(", "));
        toast.success("Auth settings saved");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <form
      className="mt-8 space-y-6 rounded-lg border bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ signupsOpen, allowedEmailDomains: domains });
      }}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id="signups-open"
          checked={signupsOpen}
          onCheckedChange={(checked) => setSignupsOpen(checked === true)}
        />
        <div className="space-y-0.5">
          <Label htmlFor="signups-open">Allow new sign-ups</Label>
          <p className="text-xs text-muted-foreground">
            When off, new accounts cannot be created. Existing accounts still sign in.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="allowed-domains">Allowed email domains</Label>
        <Input
          id="allowed-domains"
          value={domains}
          placeholder="example.edu, alumni.example.edu"
          onChange={(event) => setDomains(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to allow any email domain. Separate domains with commas.
        </p>
      </div>

      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save auth settings"}
      </Button>
    </form>
  );
}
