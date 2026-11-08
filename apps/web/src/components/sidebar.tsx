"use client";

import { hasPermission } from "@Alumni-Network/auth/permissions";
import { cn } from "@Alumni-Network/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarPlus,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

type NavLink = {
  to: string;
  label: string;
  plain?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

function isActive(pathname: string, to: string) {
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

function NavList({
  links,
  pathname,
  collapsed = false,
}: {
  links: NavLink[];
  pathname: string;
  collapsed?: boolean;
}) {
  const base =
    "flex items-center rounded-md py-2 text-sm transition-colors hover:bg-muted hover:text-foreground";
  return (
    <ul className="space-y-1">
      {links.map(({ to, label, plain, icon: Icon }) => {
        const active = isActive(pathname, to);
        const className = cn(
          base,
          collapsed ? "justify-center px-2" : "px-3",
          active
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground",
        );
        const current = active ? ("page" as const) : undefined;
        const body = (
          <>
            <Icon className="size-4 shrink-0" />
            <span className={cn(collapsed && "sr-only")}>{label}</span>
          </>
        );
        if (plain) {
          return (
            <li key={to}>
              <a
                href={to}
                aria-current={current}
                aria-label={label}
                title={collapsed ? label : undefined}
                className={className}
              >
                {body}
              </a>
            </li>
          );
        }
        return (
          <li key={to}>
            <Link
              href={to as "/dashboard"}
              aria-current={current}
              aria-label={label}
              title={collapsed ? label : undefined}
              className={className}
            >
              {body}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Sidebar({
  open,
  onClose,
  collapsed = false,
}: {
  open: boolean;
  onClose: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();
  const flags = useQuery(trpc.settings.publicModuleFlags.queryOptions());

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!session?.user) return null;

  const user = session.user;
  const eventsEnabled = flags.data?.events !== false;
  const recordsEnabled = flags.data?.records !== false;
  const reportsEnabled = flags.data?.reports !== false;
  const canManageEvents = hasPermission(user, "events:manage");
  const canViewRecords = hasPermission(user, "records:view");
  const canViewReports = hasPermission(user, "reports:view");
  const canManageSettings = hasPermission(user, "settings:manage");
  const isAdmin = user.role === "admin";

  const mainLinks: NavLink[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/profile", label: "Profile", icon: User },
    ...(eventsEnabled ? [{ to: "/events", label: "Events", icon: CalendarDays }] : []),
    { to: "/settings/account", label: "Settings", icon: Settings },
  ];

  const adminLinks: NavLink[] = [
    ...(recordsEnabled && canViewRecords
      ? [{ to: "/admin/alumni", label: "Alumni Records", icon: Users }]
      : []),
    ...(reportsEnabled && canViewReports
      ? [{ to: "/admin/reports", label: "Reports", plain: true, icon: BarChart3 }]
      : []),
    ...(eventsEnabled && canManageEvents
      ? [{ to: "/admin/events", label: "Event management", icon: CalendarPlus }]
      : []),
    ...(isAdmin ? [{ to: "/admin/access", label: "Access", icon: ShieldCheck }] : []),
    ...(canManageSettings
      ? [{ to: "/admin/settings/organization", label: "Organization settings", icon: Building2 }]
      : []),
  ];

  const renderNavBody = (isCollapsed: boolean) => (
    <nav
      aria-label="Primary"
      className={cn("space-y-6", isCollapsed ? "p-2" : "p-4")}
    >
      <div>
        <NavList links={mainLinks} pathname={pathname} collapsed={isCollapsed} />
      </div>
      {adminLinks.length > 0 && (
        <div>
          <p
            className={cn(
              "pb-2 font-heading text-xs font-semibold uppercase tracking-[0.5px] text-muted-foreground",
              isCollapsed ? "px-2 text-center" : "px-3",
            )}
          >
            {isCollapsed ? "···" : "Admin"}
          </p>
          <NavList links={adminLinks} pathname={pathname} collapsed={isCollapsed} />
        </div>
      )}
    </nav>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-card md:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="sticky top-0">{renderNavBody(collapsed)}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[80vw] overflow-y-auto border-r bg-card">
            {renderNavBody(false)}
          </aside>
        </div>
      )}
    </>
  );
}
