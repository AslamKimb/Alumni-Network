"use client";

import { COUNTRIES } from "@Alumni-Network/api/countries";
import { Button } from "@Alumni-Network/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { hasPermission } from "@Alumni-Network/auth/permissions";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

// reports router is wired separately (see return snippet); cast until then.
type ReportInput = {
  campusFrom: number | null;
  campusTo: number | null;
  country: string | null;
  workStatus: string | null;
  educationLevel: string | null;
  dutyType: string | null;
};

type ChartSlice = { label: string; count: number };

type ReportData = {
  kpis: { total: number; complete: number; employedPct: number; abroadPct: number | null; new30d: number };
  charts: {
    country: ChartSlice[];
    city: ChartSlice[];
    campusYear: ChartSlice[];
    workStatus: ChartSlice[];
    education: ChartSlice[];
    topTitles: ChartSlice[];
    dutyParticipation: { religious: number; political: number; other: number };
  };
  preview: {
    id: string;
    fullName: string;
    campusStartYear: number | null;
    campusEndYear: number | null;
    city: string | null;
    countryName: string | null;
    countryCode: string | null;
    workStatus: string | null;
    professionalTitle: string | null;
    updatedAt: Date | string | null;
  }[];
  exportEnabled: boolean;
};

type Filters = { country: string; campusFrom: string; campusTo: string; workStatus: string; educationLevel: string; dutyType: string };

const emptyFilters: Filters = { country: "", campusFrom: "", campusTo: "", workStatus: "", educationLevel: "", dutyType: "" };

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isInteger(num) ? num : null;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Bars({ title, slices, total, note }: { title: string; slices: ChartSlice[]; total: number; note?: string }) {
  const max = Math.max(1, ...slices.map((s) => s.count));
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="font-medium">{title}</h2>
      {slices.length === 0 || total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No data for these filters</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {slices.map((slice) => {
            const share = total > 0 ? (slice.count / total) * 100 : 0;
            return (
              <li key={slice.label} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
                <span className="truncate" title={slice.label}>
                  {slice.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {slice.count} · {share.toFixed(1)}%
                </span>
                <span className="col-span-2 h-2 rounded bg-muted" aria-hidden>
                  <span className="block h-2 rounded bg-primary" style={{ width: `${Math.max(2, (slice.count / max) * 100)}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
    </section>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC() as unknown as {
    reports: {
      getReport: { queryOptions: (input: ReportInput) => object };
      exportRecordsCSV: { queryOptions: (input: ReportInput) => object };
      exportAggregatesCSV: { queryOptions: (input: ReportInput) => object };
    };
    settings: {
      publicModuleFlags: { queryOptions: () => object };
    };
  };
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions() as never) as unknown as {
    data?: { reports?: boolean };
  };

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [presentation, setPresentation] = useState(false);

  const reportInput = useMemo<ReportInput>(
    () => ({
      campusFrom: toNumberOrNull(filters.campusFrom),
      campusTo: toNumberOrNull(filters.campusTo),
      country: filters.country || null,
      workStatus: filters.workStatus || null,
      educationLevel: filters.educationLevel || null,
      dutyType: filters.dutyType || null,
    }),
    [filters],
  );

  // Debounce filter changes briefly so the report doesn't refetch per keystroke.
  const [debouncedInput, setDebouncedInput] = useState(reportInput);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(reportInput), 300);
    return () => clearTimeout(timer);
  }, [reportInput]);

  const report = useQuery(trpc.reports.getReport.queryOptions(debouncedInput) as never) as unknown as {
    data?: ReportData;
    isPending: boolean;
    isError: boolean;
  };
  const data = report.data;
  const total = data?.kpis.total ?? 0;

  const set = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }));

  const exportCsv = async (kind: "records" | "aggregates") => {
    try {
      const query =
        kind === "records"
          ? trpc.reports.exportRecordsCSV.queryOptions(debouncedInput)
          : trpc.reports.exportAggregatesCSV.queryOptions(debouncedInput);
      const result = (await queryClient.fetchQuery(query as never)) as unknown as {
        filename: string;
        csv: string;
        rowCount: number;
      };
      downloadCsv(result.filename, result.csv);
      toast.success(`Exported ${result.rowCount} rows`);
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

  if (session.user.role !== "admin" && !hasPermission(session.user, "reports:view")) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </main>
    );
  }

  if (flags.data?.reports === false) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-6">
        <h1>Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is not available.</p>
      </main>
    );
  }

  const exportEnabled = data?.exportEnabled !== false;

  return (
    <main
      className={`mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-6 ${presentation ? "report-presentation" : ""}`}
      data-presentation={presentation}
      style={presentation ? { maxWidth: "none", padding: 16 } : undefined}
    >
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } .report-presentation header, .report-presentation footer { display: none !important; } .no-print { display: none !important; } }`}</style>
      <style>{`body:has(.report-presentation) header, body:has(.report-presentation) footer { display: none !important; }`}</style>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.5px] text-highlight">Admin</p>
          <h1 className="mt-2">Reports</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Live aggregates for the current filters. Generated {new Date().toLocaleString()}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exportEnabled && total > 0 ? (
            <>
              <Button size="sm" onClick={() => void exportCsv("records")}>
                Export records CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => void exportCsv("aggregates")}>
                Export aggregates CSV
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPresentation((p) => !p)}>
            {presentation ? "Exit presentation" : "Presentation"}
          </Button>
        </div>
      </div>

      <div className={`mt-8 rounded-lg border bg-card p-4 ${presentation ? "no-print" : ""}`} style={presentation ? { display: "none" } : undefined}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Campus from</span>
            <input className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm font-mono" placeholder="2018" inputMode="numeric" value={filters.campusFrom} onChange={(e) => set({ campusFrom: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Campus to</span>
            <input className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm font-mono" placeholder="2022" inputMode="numeric" value={filters.campusTo} onChange={(e) => set({ campusTo: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Country</span>
            <select className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm" value={filters.country} onChange={(e) => set({ country: e.target.value })}>
              <option value="">All</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Work status</span>
            <select className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm" value={filters.workStatus} onChange={(e) => set({ workStatus: e.target.value })}>
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
            <select className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm" value={filters.educationLevel} onChange={(e) => set({ educationLevel: e.target.value })}>
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
            <select className="h-10 w-full rounded-md border px-3 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10 text-sm" value={filters.dutyType} onChange={(e) => set({ dutyType: e.target.value })}>
              <option value="">All</option>
              <option value="religious">Religious</option>
              <option value="political">Political</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => setFilters(emptyFilters)}>
            Reset
          </Button>
        </div>
      </div>

      {report.isError ? <p className="mt-8 text-sm text-error-text">Could not load the report. The reports router may need wiring.</p> : null}
      {report.isPending ? <p className="mt-8 text-sm text-muted-foreground">Loading…</p> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Total</p>
          <p className="mt-1 text-3xl font-semibold">{total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Complete</p>
          <p className="mt-1 text-3xl font-semibold">{(data?.kpis.complete ?? 0).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Employed</p>
          <p className="mt-1 text-3xl font-semibold">{(data?.kpis.employedPct ?? 0).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Abroad</p>
          {data?.kpis.abroadPct == null ? (
            <p className="mt-2 text-sm text-muted-foreground">Set home country in Settings</p>
          ) : (
            <p className="mt-1 text-3xl font-semibold">{data.kpis.abroadPct.toFixed(1)}%</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">New · last 30 days</p>
          <p className="mt-1 text-3xl font-semibold">{data?.kpis.new30d ?? 0}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Bars title="Country" slices={data?.charts.country ?? []} total={total} />
        <Bars title="City" slices={data?.charts.city ?? []} total={total} />
        <Bars title="Campus year" slices={data?.charts.campusYear ?? []} total={total} />
        <Bars title="Work status" slices={data?.charts.workStatus ?? []} total={total} />
        <Bars title="Highest education" slices={data?.charts.education ?? []} total={total} />
        <Bars title="Top professional titles" slices={data?.charts.topTitles ?? []} total={total} note="Professional titles are free text; exact-match counts" />
        <Bars
          title="Duty participation"
          total={total}
          slices={
            data
              ? [
                  { label: "religious", count: data.charts.dutyParticipation.religious },
                  { label: "political", count: data.charts.dutyParticipation.political },
                  { label: "other", count: data.charts.dutyParticipation.other },
                ].filter((s) => s.count > 0)
              : []
          }
        />
      </div>

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="font-medium">Preview</h2>
        {(data?.preview ?? []).length === 0 && !report.isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">No data for these filters</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Campus years</th>
                  <th scope="col" className="px-3 py-2 font-medium">Location</th>
                  <th scope="col" className="px-3 py-2 font-medium">Work status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Title</th>
                </tr>
              </thead>
              <tbody>
                {(data?.preview ?? []).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{row.fullName}</td>
                    <td className="px-3 py-2 font-mono">
                      {row.campusStartYear ?? "—"}–{row.campusEndYear ?? "—"}
                    </td>
                    <td className="px-3 py-2">{[row.city, row.countryName ?? row.countryCode].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2">{row.workStatus ?? "—"}</td>
                    <td className="px-3 py-2">{row.professionalTitle ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="mt-6 text-xs text-muted-foreground">Alumni Network · Generated {new Date().toLocaleString()}</footer>
    </main>
  );
}
