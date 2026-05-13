"use client";

/**
 * Unified My Views sidebar — replaces the legacy left rail for /views/* routes.
 *
 * Phase B3 wires the route segments with this skeleton mount. Phase B6
 * (in this same implementer pass) replaces this body with the real
 * SidebarTopNav + MyViewsSection content. Until then the column is rendered
 * so the layout's flex split is observable from /views.
 */
import { useViewsStore, selectDensity } from "../lib/store";
import SidebarTopNav from "./SidebarTopNav";
import MyViewsSection from "./MyViewsSection";
import SidebarFooter from "./SidebarFooter";

export default function ViewsSidebar() {
  const density = useViewsStore(selectDensity);
  // 252px compact (default) / 268px comfortable per the design handoff.
  const widthClass = density === "comfortable" ? "w-[268px]" : "w-[252px]";

  return (
    <aside
      className={`flex-shrink-0 flex flex-col bg-white border-r border-[#D4CFE2] ${widthClass}`}
      // pan-y permits inner scroll on iOS without interfering with siblings.
      // The sidebar never contains a map, so this is safe per CLAUDE.md.
      style={{ touchAction: "pan-y" }}
    >
      <SidebarTopNav />
      <MyViewsSection />
      <SidebarFooter />
    </aside>
  );
}
