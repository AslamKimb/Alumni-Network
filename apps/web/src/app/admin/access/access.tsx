"use client";

import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
} from "@Alumni-Network/auth/permissions";
import { Button } from "@Alumni-Network/ui/components/button";
import { Checkbox } from "@Alumni-Network/ui/components/checkbox";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  deactivatedAt: string | null;
  createdAt: string;
};

const PAGE_SIZE = 25;

function permissionsSummary(account: Account) {
  if (account.role === "admin") return "Full access (admin role)";
  if (account.permissions.length === 0) return "No extra permissions";
  return account.permissions
    .map((key) => PERMISSION_LABELS[key as keyof typeof PERMISSION_LABELS] ?? key)
    .join(", ");
}

export default function Access() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "admin" | "alumnus">("all");
  const [status, setStatus] = useState<"all" | "active" | "deactivated">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Account | null>(null);

  // Debounce search at 300ms (mirrors alumni page pattern).
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role, status]);

  const queryInput = useMemo(
    () => ({
      search: debouncedSearch || null,
      role,
      status,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, role, status, page],
  );

  const list = useQuery(trpc.access.list.queryOptions(queryInput));

  // Close the detail drawer on Esc.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.access.list.queryKey() });
  const onError = (error: { message: string }) => toast.error(error.message);

  const setRoleMutation = useMutation(
    trpc.access.setRole.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Role updated");
      },
      onError,
    }),
  );
  const setActiveMutation = useMutation(
    trpc.access.setActive.mutationOptions({
      onSuccess: (_data, variables) => {
        refresh();
        toast.success(variables.active ? "Account reactivated" : "Account deactivated");
      },
      onError,
    }),
  );
  const setPermissions = useMutation(
    trpc.access.setPermissions.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Permissions updated");
      },
      onError,
    }),
  );

  if (list.isPending) {
    return <p className="mt-10 text-sm text-muted-foreground">Loading accounts…</p>;
  }

  if (!list.data) {
    return <p className="mt-10 text-sm text-muted-foreground">Could not load accounts.</p>;
  }

  const { accounts, total, filteredCount, activeAdmins } = list.data;
  const busy = setRoleMutation.isPending || setActiveMutation.isPending || setPermissions.isPending;
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  // Keep the drawer on the freshest copy of the account after a refresh.
  const liveSelected = selected
    ? (accounts.find((account) => account.id === selected.id) ?? selected)
    : null;
  const lastActiveAdmin = !!liveSelected &&
    liveSelected.role === "admin" &&
    !liveSelected.deactivatedAt &&
    activeAdmins <= 1;

  return (
    <>
      <div className="mt-8 rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2 lg:col-span-2">
            <span className="mb-1 block text-sm font-medium">Search</span>
            <input
              className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm"
              placeholder="Name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Role</span>
            <select
              className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="all">All</option>
              <option value="admin">Admin</option>
              <option value="alumnus">Alumnus</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Status</span>
            <select
              className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {list.isPending ? "Loading…" : `${filteredCount} of ${total} users`}
        </p>
      </div>

      {list.isError ? (
        <p className="mt-8 text-sm text-error-text">Could not load accounts.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-lg border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">User</th>
                  <th scope="col" className="px-4 py-3 font-medium">Role</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Permissions</th>
                  <th scope="col" className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.id}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/60"
                    onClick={() => setSelected(account)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{account.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{account.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Chip tone={account.role === "admin" ? "admin" : "alumnus"}>
                        {account.role}
                      </Chip>
                    </td>
                    <td className="px-4 py-3">
                      <Chip tone={account.deactivatedAt ? "inactive" : "active"}>
                        {account.deactivatedAt ? "Deactivated" : "Active"}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {permissionsSummary(account)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(account)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && !list.isPending ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No users match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <ul className="mt-6 space-y-3 md:hidden">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="cursor-pointer rounded-lg border bg-card p-4"
                onClick={() => setSelected(account)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{account.email}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelected(account)}>
                    Manage
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip tone={account.role === "admin" ? "admin" : "alumnus"}>{account.role}</Chip>
                  <Chip tone={account.deactivatedAt ? "inactive" : "active"}>
                    {account.deactivatedAt ? "Deactivated" : "Active"}
                  </Chip>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{permissionsSummary(account)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <span className="font-mono text-sm text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The last remaining active admin cannot be demoted or deactivated.
      </p>

      {/* Detail drawer */}
      {liveSelected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
            onClick={() => setSelected(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-drawer-title"
            className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-background p-6 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="access-drawer-title" className="truncate text-lg">
                  {liveSelected.name}
                </h2>
                <p className="truncate text-sm text-muted-foreground">{liveSelected.email}</p>
              </div>
              <Button size="sm" variant="ghost" autoFocus onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone={liveSelected.role === "admin" ? "admin" : "alumnus"}>
                {liveSelected.role}
              </Chip>
              <Chip tone={liveSelected.deactivatedAt ? "inactive" : "active"}>
                {liveSelected.deactivatedAt ? "Deactivated" : "Active"}
              </Chip>
            </div>

            <section className="mt-6">
              <h3 className="text-sm font-medium">Role</h3>
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || lastActiveAdmin}
                  onClick={() =>
                    setRoleMutation.mutate({
                      userId: liveSelected.id,
                      role: liveSelected.role === "admin" ? "alumnus" : "admin",
                    })
                  }
                >
                  {liveSelected.role === "admin" ? "Remove admin" : "Make admin"}
                </Button>
                {lastActiveAdmin && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    This is the last active admin and cannot be demoted or deactivated.
                  </p>
                )}
              </div>
            </section>

            <section className="mt-6">
              <h3 className="text-sm font-medium">Permissions</h3>
              {liveSelected.role === "admin" ? (
                <p className="mt-2 text-sm text-muted-foreground">Full access (admin role)</p>
              ) : (
                <fieldset className="mt-2 grid gap-2">
                  <legend className="sr-only">Permissions for {liveSelected.name}</legend>
                  {PERMISSION_KEYS.map((key) => {
                    const checkboxId = `${liveSelected.id}-${key}`;
                    const checked = liveSelected.permissions.includes(key);
                    return (
                      <label key={key} className="flex items-start gap-2.5 rounded-md border p-3">
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          disabled={busy}
                          onCheckedChange={() => {
                            const next = checked
                              ? liveSelected.permissions.filter((p) => p !== key)
                              : [...liveSelected.permissions, key];
                            setPermissions.mutate({ userId: liveSelected.id, permissions: next });
                          }}
                        />
                        <span>
                          <span className="block text-sm font-medium">{PERMISSION_LABELS[key]}</span>
                          <span className="block text-xs text-muted-foreground">
                            {PERMISSION_DESCRIPTIONS[key]}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </section>

            <section className="mt-6">
              <h3 className="text-sm font-medium">Account status</h3>
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || lastActiveAdmin}
                  onClick={() =>
                    setActiveMutation.mutate({
                      userId: liveSelected.id,
                      active: !!liveSelected.deactivatedAt,
                    })
                  }
                >
                  {liveSelected.deactivatedAt ? "Reactivate" : "Deactivate"}
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
