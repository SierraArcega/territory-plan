"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/features/shared/components/layout/AppShell";
import { useMapStore } from "@/features/shared/lib/app-store";
import { useProfile } from "@/features/shared/lib/queries";

export default function DocumentGeneratorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const sidebarCollapsed = useMapStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useMapStore((s) => s.setSidebarCollapsed);
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  // Collapse sidebar on narrow viewports — mirrors views/layout.tsx pattern.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  }, []);

  return (
    <AppShell
      activeTab={"views" as const}
      onTabChange={(tab) => {
        if (tab === "views") return;
        router.push(`/?tab=${tab}`);
      }}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
      isAdmin={isAdmin}
      hideFilterBar
    >
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}
