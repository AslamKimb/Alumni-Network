"use client";

import * as React from "react";

import Footer from "./footer";
import Header from "./header";
import Sidebar from "./sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const toggleCollapsed = React.useCallback(
    () => setCollapsed((value) => !value),
    [],
  );

  // Persist desktop collapse preference across sessions; initial mount
  // always starts expanded to avoid hydration mismatch.
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("sidebar-collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {
      // localStorage unavailable; keep in-memory state only.
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        "sidebar-collapsed",
        collapsed ? "1" : "0",
      );
    } catch {
      // ignore
    }
  }, [collapsed]);

  return (
    <div className="flex min-h-svh flex-col">
      <Header
        onMenuClick={() => setOpen((value) => !value)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar open={open} onClose={close} collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}
