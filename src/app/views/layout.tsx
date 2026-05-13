/**
 * Layout for the unified My Views feature.
 *
 * Mounts the new ViewsSidebar to the left of every /views/* child page. The
 * legacy AppShell + Sidebar remain on / for legacy tabs (?tab=plans etc.) —
 * see CLAUDE.md / spec for the migration plan. This route segment owns its
 * own sidebar, no nesting under the global shell.
 *
 * Phase F4: at viewport widths below 768px (Tailwind `md`), the sidebar
 * collapses behind a hamburger button rendered in a mobile top bar. The
 * mobile state is owned here so we can re-render the bar + sidebar without
 * widening the views store; if a future feature needs to drive the overlay
 * from outside the layout, lift it into the store at that point.
 */
"use client";

import { Suspense, useState } from "react";
import { Menu } from "lucide-react";
import ViewsSidebar from "@/features/views/components/ViewsSidebar";
import DetailPanel from "@/features/views/components/detail/DetailPanel";
import ListBuilderModal from "@/features/views/components/builder/ListBuilderModal";

export default function ViewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-[#FFFCFA] overflow-hidden">
      {/* Suspense around the sidebar protects against future async hooks
          (queries) that may use the new Next 16 caching primitives. */}
      <Suspense
        fallback={
          <aside className="hidden md:flex w-[252px] flex-shrink-0 border-r border-[#D4CFE2] bg-white" />
        }
      >
        <ViewsSidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      </Suspense>
      {/*
        Main canvas — children render the portfolio, group canvas, or detail
        panel host. min-w-0 is critical so flex children can shrink rather
        than overflow horizontally (per CLAUDE.md narrow-width guidance).
        `relative` anchors the absolutely-positioned <DetailPanel/> below to
        this column so the panel slides in over the canvas (not the sidebar)
        and never covers the My Views nav.
      */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        {/* Mobile top bar — visible below md (768px) only. Hamburger toggles
            the sidebar overlay. The title slot is a placeholder for now;
            once we have an active-group context we can surface the plan
            name here. */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-[#D4CFE2] bg-white">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
            className="p-1.5 rounded-md text-[#403770] hover:bg-[#EFEDF5] transition-colors duration-100"
          >
            <Menu className="w-5 h-5" aria-hidden strokeWidth={2} />
          </button>
          <span className="text-sm font-semibold text-[#403770] whitespace-nowrap truncate">
            My Views
          </span>
        </div>

        <Suspense fallback={null}>{children}</Suspense>
        {/*
          DetailPanel reads its open state from `useViewsRouter().detail`. It
          renders null when no `?detail=kind:id` param is present, so this
          mount is effectively a no-op for the portfolio view and any
          non-detail interaction.
        */}
        <Suspense fallback={null}>
          <DetailPanel />
        </Suspense>
      </main>
      {/*
        ListBuilderModal — mounted once at the layout level so all three
        triggers (sidebar Lists "+", footer dashed "+ New list", canvas
        "Save as list") open the same instance via useViewsStore.builderOpen.
        Renders null when closed.
      */}
      <Suspense fallback={null}>
        <ListBuilderModal />
      </Suspense>
    </div>
  );
}
