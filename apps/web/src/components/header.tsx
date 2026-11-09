"use client";
import { Button } from "@Alumni-Network/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Menu, PanelLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AnnouncementBell() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = useQuery({
    ...trpc.announcements.unreadCount.queryOptions(),
    enabled: !!session?.user,
  });
  const latest = useQuery({
    ...trpc.announcements.listPublished.queryOptions(),
    enabled: !!session?.user,
  });

  const markRead = useMutation(
    trpc.announcements.markRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.announcements.unreadCount.queryKey() });
      },
    }),
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session?.user) return null;

  const count = unread.data?.count ?? 0;
  const items = (latest.data ?? []).slice(0, 5);

  return (
    <div ref={panelRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Announcements"
        aria-expanded={open}
        title="Announcements"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-card p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold">Announcements</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={markRead.isPending || count === 0}
              onClick={() => markRead.mutate()}
            >
              Mark all read
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/announcements/${item.id}`}
                    className="block rounded px-2 py-2 hover:bg-muted/60"
                    onClick={() => setOpen(false)}
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(item.publishedAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/announcements"
            className="mt-1 block rounded px-2 py-2 text-center text-sm font-medium text-highlight hover:bg-muted/60"
            onClick={() => setOpen(false)}
          >
            View all announcements
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Header({
  onMenuClick,
  collapsed,
  onToggleCollapse,
}: {
  onMenuClick?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const trpc = useTRPC();
  const org = useQuery(trpc.settings.getOrganization.queryOptions());

  const orgName = org.data?.name?.trim() || "Alumni Network";
  const shortName = org.data?.shortName?.trim() ?? "";
  const logoUrl = org.data?.logoUrl?.trim() ?? "";
  const [logoError, setLogoError] = useState(false);
  useEffect(() => setLogoError(false), [logoUrl]);

  return (
    <header className="shrink-0 border-b bg-card">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {onMenuClick && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={onMenuClick}
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" />
            </Button>
          )}
          {onToggleCollapse && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="hidden md:inline-flex"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="size-5" />
            </Button>
          )}
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt=""
                className="grid size-8 shrink-0 place-items-center rounded-md object-cover"
                onError={() => setLogoError(true)}
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
        </div>
        <div className="flex items-center gap-2">
          <AnnouncementBell />
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
