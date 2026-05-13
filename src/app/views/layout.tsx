/**
 * Layout for the unified My Views feature.
 *
 * Mounts the new ViewsSidebar to the left of every /views/* child page. The
 * legacy AppShell + Sidebar remain on / for legacy tabs (?tab=plans etc.) —
 * see CLAUDE.md / spec for the migration plan. This route segment owns its
 * own sidebar, no nesting under the global shell.
 */
import { Suspense } from "react";
import ViewsSidebar from "@/features/views/components/ViewsSidebar";

export default function ViewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen w-screen bg-[#FFFCFA] overflow-hidden">
      {/* Suspense around the sidebar protects against future async hooks
          (queries) that may use the new Next 16 caching primitives. */}
      <Suspense fallback={<aside className="w-[252px] flex-shrink-0 border-r border-[#D4CFE2] bg-white" />}>
        <ViewsSidebar />
      </Suspense>
      {/* Main canvas — children render the portfolio, group canvas, or detail
          panel host. min-w-0 is critical so flex children can shrink rather
          than overflow horizontally (per CLAUDE.md narrow-width guidance). */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </div>
  );
}
