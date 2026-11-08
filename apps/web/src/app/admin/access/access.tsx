"use client";

import { Button } from "@Alumni-Network/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

type Tone = "admin" | "alumnus" | "active" | "inactive";

const toneClass: Record<Tone, string> = {
  admin: "bg-primary text-primary-foreground",
  alumnus: "bg-secondary text-secondary-foreground",
  active: "bg-highlight/10 text-highlight",
  inactive: "bg-muted text-muted-foreground",
};

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex min-w-24 items-center justify-center rounded-sm px-3 py-1 text-xs font-medium tracking-[0.5px] uppercase ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

export default function Access() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const list = useQuery(trpc.access.list.queryOptions());

  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.access.list.queryKey() });
  const onError = (error: { message: string }) => toast.error(error.message);

  const setRole = useMutation(
    trpc.access.setRole.mutationOptions({ onSuccess: refresh, onError }),
  );
  const setActive = useMutation(
    trpc.access.setActive.mutationOptions({ onSuccess: refresh, onError }),
  );

  if (list.isPending) {
    return <p className="mt-10 text-sm text-muted-foreground">Loading accounts…</p>;
  }

  if (!list.data) {
    return <p className="mt-10 text-sm text-muted-foreground">Could not load accounts.</p>;
  }

  const { accounts, activeAdmins } = list.data;
  const busy = setRole.isPending || setActive.isPending;

  return (
    <>
      <ul className="mt-8 divide-y divide-border rounded-lg border bg-card">
        {accounts.map((account) => {
          const lastActiveAdmin =
            account.role === "admin" && !account.deactivatedAt && activeAdmins <= 1;

          return (
            <li
              key={account.id}
              className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors hover:bg-muted/60"
            >
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <p className="truncate text-base">{account.name}</p>
                <p className="truncate text-sm text-muted-foreground">{account.email}</p>
              </div>

              <Chip tone={account.role === "admin" ? "admin" : "alumnus"}>{account.role}</Chip>
              <Chip tone={account.deactivatedAt ? "inactive" : "active"}>
                {account.deactivatedAt ? "Deactivated" : "Active"}
              </Chip>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || lastActiveAdmin}
                  onClick={() =>
                    setRole.mutate({
                      userId: account.id,
                      role: account.role === "admin" ? "alumnus" : "admin",
                    })
                  }
                >
                  {account.role === "admin" ? "Remove admin" : "Make admin"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || lastActiveAdmin}
                  onClick={() => setActive.mutate({ userId: account.id, active: !!account.deactivatedAt })}
                >
                  {account.deactivatedAt ? "Reactivate" : "Deactivate"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        The last remaining active admin cannot be demoted or deactivated.
      </p>
    </>
  );
}
