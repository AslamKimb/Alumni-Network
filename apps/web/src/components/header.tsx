"use client";
import { hasPermission } from "@Alumni-Network/auth/permissions";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

function monogram(shortName: string, name: string) {
  if (shortName.trim()) return shortName.trim().slice(0, 2).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || "AN";
}

const signedInLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/profile", label: "Profile" },
  { to: "/events", label: "Events", module: "events" },
  { to: "/settings/account", label: "Settings" },
] as const;

const adminLinks = [
  { to: "/admin/alumni", label: "Alumni Records", module: "records" },
  { to: "/admin/events", label: "Event management", module: "events" },
] as const;

export default function Header() {
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();
  const org = useQuery(trpc.settings.getOrganization.queryOptions());
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());
  const eventsEnabled = flags.data?.events !== false;
  const recordsEnabled = flags.data?.records !== false;
  const reportsEnabled = flags.data?.reports !== false;
  const visibleSignedIn = signedInLinks.filter(
    (l) => !("module" in l) || (l.module === "events" ? eventsEnabled : true),
  );
  const visibleAdmin = adminLinks.filter((l) =>
    l.module === "records" ? recordsEnabled : l.module === "events" ? eventsEnabled : true,
  );

  const orgName = org.data?.name?.trim() || "Alumni Network";
  const shortName = org.data?.shortName?.trim() ?? "";
  const logoUrl = org.data?.logoUrl?.trim() ?? "";
  const isAdmin = session?.user.role === "admin";
  const isSignedIn = Boolean(session?.user);
  const canManageEvents = Boolean(session?.user) && hasPermission(session!.user, "events:manage");
  const canViewRecords = Boolean(session?.user) && hasPermission(session!.user, "records:view");
  const canViewReports = Boolean(session?.user) && hasPermission(session!.user, "reports:view");

  const linkClassName =
    "rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <header className="shrink-0 border-b bg-card">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="grid size-8 shrink-0 place-items-center rounded-md object-cover"
              />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary font-heading text-sm font-bold text-primary-foreground">
                {monogram(shortName, orgName)}
              </span>
            )}
            <span className="truncate font-heading text-base font-semibold tracking-tight">
              {orgName}
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {!isSignedIn && (
              <>
                <Link href="/" className={linkClassName}>
                  Home
                </Link>
                <Link href="/login?mode=signin" className={linkClassName}>
                  Sign in
                </Link>
                <Link href="/login?mode=signup" className={linkClassName}>
                  Sign up
                </Link>
              </>
            )}
            {isSignedIn &&
              visibleSignedIn.map(({ to, label }) => (
                <Link key={to} href={to} className={linkClassName}>
                  {label}
                </Link>
              ))}
            {isSignedIn &&
              visibleAdmin.map(({ to, label }) => {
                const allowed = to === "/admin/alumni" ? canViewRecords : canManageEvents;
                if (!allowed) return null;
                return (
                  <Link key={to} href={to} className={linkClassName}>
                    {label}
                  </Link>
                );
              })}
            {isSignedIn && canViewReports && reportsEnabled && (
              /* Plain anchor: /admin/reports is not a typed route yet. */
              <a href="/admin/reports" className={linkClassName}>
                Reports
              </a>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
