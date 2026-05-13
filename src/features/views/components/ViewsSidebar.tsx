"use client";

/**
 * Unified My Views sidebar — replaces the legacy left rail for /views/* routes.
 *
 * Desktop (≥768px): renders as a fixed-width left column (252px compact /
 * 268px comfortable) anchored inside the layout's flex row. No overlay.
 *
 * Mobile (<768px): the sidebar is hidden by default. When the layout's
 * hamburger flips `mobileOpen` true, the sidebar slides in over the canvas
 * as a fixed-position overlay (300ms ease-out), backed by a translucent plum
 * backdrop. Tapping the backdrop OR any nav item closes the overlay.
 *
 * The sidebar never wraps a MapV2 instance, so `touch-action: pan-y` is safe
 * here (per CLAUDE.md). The backdrop uses `overscroll-behavior: none` to
 * prevent body-scroll chaining — we deliberately do NOT set `overflow: hidden`
 * on body/html (per CLAUDE.md mobile rules).
 */
import { useEffect } from "react";
import { useViewsStore, selectDensity } from "../lib/store";
import SidebarTopNav from "./SidebarTopNav";
import MyViewsSection from "./MyViewsSection";
import SidebarFooter from "./SidebarFooter";

interface ViewsSidebarProps {
  /**
   * When true (mobile-only), render the sidebar as a fixed-position overlay
   * over the canvas. Desktop layouts pass undefined and the prop has no
   * effect — the sidebar always renders in-flow at md+ breakpoints.
   */
  mobileOpen?: boolean;
  /** Callback fired when the user taps a nav item / the backdrop. */
  onMobileClose?: () => void;
}

export default function ViewsSidebar({
  mobileOpen,
  onMobileClose,
}: ViewsSidebarProps = {}) {
  const density = useViewsStore(selectDensity);
  // 252px compact (default) / 268px comfortable per the design handoff.
  const widthClass = density === "comfortable" ? "w-[268px]" : "w-[252px]";

  // Close the mobile overlay on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onMobileClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {/* Mobile backdrop — only present when sidebar is open. The plum tint
          matches the prototype's `rgba(64,55,112,0.45)`. */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 transition-opacity duration-300"
          style={{
            background: "rgba(64,55,112,0.45)",
            overscrollBehavior: "none",
          }}
          onClick={onMobileClose}
          aria-hidden
        />
      )}

      <aside
        className={[
          "flex-shrink-0 flex flex-col bg-white border-r border-[#D4CFE2]",
          widthClass,
          // Mobile: fixed-position slide-in. Desktop (md+): in-flow, no
          // transform. The `transform` on mobile starts at -100% so the
          // sidebar lives off-canvas when closed.
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out md:static md:translate-x-0 md:transform-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        // pan-y permits inner scroll on iOS without interfering with siblings.
        // The sidebar never contains a map, so this is safe per CLAUDE.md.
        style={{ touchAction: "pan-y" }}
        // Tap any descendant link/button closes the mobile overlay. We
        // attach at the aside level so the SidebarTopNav / MyViewsSection
        // children don't need awareness of the mobile state.
        onClick={(e) => {
          if (!mobileOpen) return;
          const target = e.target as HTMLElement | null;
          if (!target) return;
          // Only close when the user actually activates a nav link/button —
          // avoid swallowing clicks on scroll containers / static text.
          if (
            target.closest("a") ||
            target.closest("button[type='button']")
          ) {
            onMobileClose?.();
          }
        }}
      >
        <SidebarTopNav />
        <MyViewsSection />
        <SidebarFooter />
      </aside>
    </>
  );
}
