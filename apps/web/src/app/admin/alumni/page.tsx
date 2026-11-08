"use client";

import { Button } from "@Alumni-Network/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { hasPermission } from "@Alumni-Network/auth/permissions";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

const PAGE_SIZE = 25;

type Filters = {
  search: string;
  country: string;
  campusFrom: string;
  campusTo: string;
  workStatus: string;
  educationLevel: string;
  dutyType: string;
};

const emptyFilters: Filters = {
  search: "",
  country: "",
  campusFrom: "",
  campusTo: "",
  workStatus: "",
  educationLevel: "",
  dutyType: "",
};

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isInteger(num) ? num : null;
}

function chipClassName(tone: "ok" | "warn" | "muted") {
  if (tone === "warn") return "bg-warning/15 text-warning";
  if (tone === "muted") return "bg-muted text-muted-foreground";
  return "bg-highlight/10 text-highlight";
}

export default function AdminAlumniPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<"name" | "campusEnd" | "updated">("updated");
  const [status, setStatus] = useState<"active" | "deactivated" | "all" | "incomplete">("active");
  const [page, setPage] = useState(1);

  // Debounce search at 300ms (spec §4.5).
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort, status, filters.country, filters.campusFrom, filters.campusTo, filters.workStatus, filters.educationLevel, filters.dutyType]);

  const queryInput = useMemo(
    () => ({
      search: debouncedSearch || null,
      country: filters.country || null,
      campusFrom: toNumberOrNull(filters.campusFrom),
      campusTo: toNumberOrNull(filters.campusTo),
      workStatus: (filters.workStatus || null) as "employed" | "self_employed" | "student" | "unemployed" | "retired" | "other" | null,
      educationLevel: (filters.educationLevel || null) as "secondary" | "certificate" | "diploma" | "bachelor" | "master" | "doctorate" | "other" | null,
      dutyType: (filters.dutyType || null) as "religious" | "political" | "other" | null,
      status,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, filters, sort, status, page],
  );

  const list = useQuery({
    ...trpc.alumni.list.queryOptions(queryInput),
    enabled: flags.data?.records !== false,
  });

  const set = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }));

  const exportCsv = async () => {
    try {
      const { sort: _sort, page: _page, pageSize: _pageSize, ...exportFilters } = queryInput;
      const data = await queryClient.fetchQuery(trpc.alumni.exportCSV.queryOptions(exportFilters));
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.rowCount} rows`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  if (sessionPending) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-6">
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

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">Admin</p>
          <h1 className="mt-2">Alumni records</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Search and read every alumnus record. Deactivated accounts are hidden unless you filter for them.
          </p>
        </div>
        <Button size="sm" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <div className="mt-8 rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="mb-1 block text-sm font-medium">Search</span>
            <input
              className="h-10 w-full rounded-md border px-3 text-sm"
              placeholder="Name, email, city, employer, title…"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Country (ISO code)</span>
            <input
              className="h-10 w-full rounded-md border px-3 text-sm uppercase"
              placeholder="e.g. GB"
              maxLength={2}
              value={filters.country}
              onChange={(e) => set({ country: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Campus from</span>
            <input
              className="h-10 w-full rounded-md border px-3 text-sm font-mono"
              placeholder="2018"
              inputMode="numeric"
              value={filters.campusFrom}
              onChange={(e) => set({ campusFrom: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Campus to</span>
            <input
              className="h-10 w-full rounded-md border px-3 text-sm font-mono"
              placeholder="2022"
              inputMode="numeric"
              value={filters.campusTo}
              onChange={(e) => set({ campusTo: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Work status</span>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={filters.workStatus}
              onChange={(e) => set({ workStatus: e.target.value })}
            >
              <option value="">All</option>
              <option value="employed">Employed</option>
              <option value="self_employed">Self-employed</option>
              <option value="student">Student</option>
              <option value="unemployed">Unemployed</option>
              <option value="retired">Retired</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Education level</span>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={filters.educationLevel}
              onChange={(e) => set({ educationLevel: e.target.value })}
            >
              <option value="">All</option>
              <option value="secondary">Secondary</option>
              <option value="certificate">Certificate</option>
              <option value="diploma">Diploma</option>
              <option value="bachelor">Bachelor</option>
              <option value="master">Master</option>
              <option value="doctorate">Doctorate</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Duty type</span>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={filters.dutyType}
              onChange={(e) => set({ dutyType: e.target.value })}
            >
              <option value="">All</option>
              <option value="religious">Religious</option>
              <option value="political">Political</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Status</span>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="active">Active</option>
              <option value="incomplete">Incomplete</option>
              <option value="deactivated">Deactivated</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Sort by</span>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="updated">Last updated</option>
              <option value="name">Name</option>
              <option value="campusEnd">Campus end year</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {list.isPending ? "Loading…" : `${total} ${total === 1 ? "record" : "records"} match the current filters.`}
        </p>
      </div>

      {list.isError ? (
        <p className="mt-8 text-sm text-destructive">Could not load records.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-lg border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Campus years</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Work status</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/alumni/${row.id}`} className="font-medium underline-offset-2 hover:underline">
                        {row.fullName}
                      </Link>
                      {row.incomplete ? (
                        <span className={`ml-2 rounded-sm px-2 py-0.5 text-xs font-medium ${chipClassName("warn")}`}>
                          Incomplete
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {row.campusStartYear ?? "—"}–{row.campusEndYear ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {[row.city, row.countryName ?? row.countryCode].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">{row.workStatus ?? "—"}</td>
                    <td className="px-4 py-3">{row.professionalTitle ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${chipClassName(row.deactivatedAt ? "muted" : "ok")}`}>
                        {row.deactivatedAt ? "Deactivated" : "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !list.isPending ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No records match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <ul className="mt-6 space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border bg-card p-4">
                <Link href={`/admin/alumni/${row.id}`} className="font-medium underline-offset-2 hover:underline">
                  {row.fullName}
                </Link>
                {row.incomplete ? (
                  <span className={`ml-2 rounded-sm px-2 py-0.5 text-xs font-medium ${chipClassName("warn")}`}>Incomplete</span>
                ) : null}
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {row.campusStartYear ?? "—"}–{row.campusEndYear ?? "—"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[row.city, row.countryName ?? row.countryCode].filter(Boolean).join(", ") || "—"}
                </p>
                <p className="mt-1 text-sm">
                  {row.workStatus ?? "—"}{row.professionalTitle ? ` · ${row.professionalTitle}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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
    </main>
  );
}
