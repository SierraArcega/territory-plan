/**
 * Layout for the unified My Views feature.
 *
 * Mounts the global AppShell so every /views/* page gets the same legacy
 * sidebar (now hosting MyViewsSection) as the rest of the app. AppShell's
 * hideFilterBar prop suppresses the global FilterBar since /views/* has
 * its own ViewTabsStrip per group.
 *
 * DetailPanel + ListBuilderModal stay mounted at this level because they
 * are route-scoped state surfaces. They render null when their open
 * states are falsy, so the mount is a no-op on the portfolio page.
 */
"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/features/shared/components/layout/AppShell";
import { useMapStore } from "@/features/shared/lib/app-store";
import { useProfile } from "@/features/shared/lib/queries";
import DetailPanel from "@/features/views/components/detail/DetailPanel";
import ListBuilderModal from "@/features/views/components/builder/ListBuilderModal";

export default function ViewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const sidebarCollapsed = useMapStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useMapStore((s) => s.setSidebarCollapsed);
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  // Collapse sidebar on first mount when viewport is narrow (< 768 px).
  // Mirrors the same logic in src/app/page.tsx for the legacy /. With the
  // /views/* hamburger overlay removed, this is the only thing keeping the
  // 252px sidebar from swallowing the canvas on iPhone-width viewports.
  // No resize listener by design — user can re-expand manually; next page
  // load re-applies. No cleanup needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  }, []);

  return (
    <AppShell
      // Sentinel — no main tab highlights while on /views/* routes; the
      // MyViewsSection inside the sidebar handles its own active state.
      activeTab={"views" as const}
      onTabChange={(tab) => {
        // "views" is a sentinel from this layout — never a real destination.
        // Mirror the guard in src/app/page.tsx's onTabChange for symmetry.
        if (tab === "views") return;
        // Main-tab clicks on /views/* leave the route and rejoin the legacy
        // app at /?tab=<id>. The legacy page reads ?tab= on mount.
        router.push(`/?tab=${tab}`);
      }}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
      isAdmin={isAdmin}
      hideFilterBar
    >
      <Suspense fallback={null}>{children}</Suspense>
      {/* DetailPanel reads ?detail=kind:id and renders null when absent. */}
      <Suspense fallback={null}>
        <DetailPanel />
      </Suspense>
      {/* ListBuilderModal reads useViewsStore.builderOpen and renders null when closed. */}
      <Suspense fallback={null}>
        <ListBuilderModal />
      </Suspense>
    </AppShell>
  );
}
