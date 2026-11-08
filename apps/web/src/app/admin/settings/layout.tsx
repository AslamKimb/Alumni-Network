"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@Alumni-Network/ui/lib/utils";

const TABS = [
  { to: "/admin/settings/organization", label: "Organization" },
  { to: "/admin/settings/auth", label: "Auth" },
  { to: "/admin/settings/profile", label: "Profile" },
  { to: "/admin/settings/events", label: "Events" },
  { to: "/admin/settings/records", label: "Records" },
  { to: "/admin/settings/reports", label: "Reports" },
  { to: "/admin/access", label: "Access" },
] as const;

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <nav aria-label="Settings" className="mx-auto w-full max-w-4xl px-4 pt-6 md:px-6">
        <div className="flex flex-wrap gap-1 border-b">
          {TABS.map(({ to, label }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                href={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
