"use client";
import { Button } from "@Alumni-Network/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Menu, PanelLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { useTRPC } from "@/utils/trpc";

function monogram(shortName: string, name: string) {
  if (shortName.trim()) return shortName.trim().slice(0, 2).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || "AN";
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
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
