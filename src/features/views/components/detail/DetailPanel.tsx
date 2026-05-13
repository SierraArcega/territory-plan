"use client";

/**
 * DetailPanel — the single right-side slide-in shell mounted once at the
 * /views/* layout level. Reads the active detail kind+id from the URL via
 * `useViewsRouter()` and dispatches to the right *DetailContent component.
 *
 * Hard rules from the Phase D brief:
 *   1. Mounts once at the layout level; never inside individual views.
 *      Switching kinds re-renders content without unmounting the shell, so
 *      no nested transitions fire mid-stream.
 *   2. 380px wide, absolutely positioned to the right edge of its containing
 *      block (the layout's <main>). NOT a modal — the underlying view stays
 *      scrollable while the panel is open.
 *   3. Slide-in: 250ms cubic-bezier(0.16, 1, 0.3, 1), translateX(20→0) +
 *      opacity 0→1 (matches the prototype's `dpSlide` / `psSlide` keyframes).
 *      Box shadow `-12px 0 32px rgba(64,55,112,0.08)` for the depth cue.
 *   4. Close behavior: X button + click anywhere outside the panel. The
 *      outside-click handler ignores clicks on `[data-row-kind][data-row-id]`
 *      rows so opening one detail panel while another is open swaps the
 *      content instead of closing first (GroupCanvas's URL push wins).
 *
 * Animation is intentionally embedded as a `<style>` block rather than a
 * Tailwind class because Tailwind 4 doesn't have a built-in keyframe with the
 * exact prototype timing/easing. globals.css has a `panel-v2-enter` keyframe
 * but it animates a centered modal — wrong axis for this right-slide-in.
 */
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useViewsRouter } from "../../hooks/useViewsRouter";
import type { DetailKind } from "../../lib/view-types";
import DistrictDetailContent from "./DistrictDetailContent";
import ContactDetailContent from "./ContactDetailContent";
import OppDetailContent from "./OppDetailContent";
import VacancyDetailContent from "./VacancyDetailContent";
import NewsDetailContent from "./NewsDetailContent";
import RfpDetailContent from "./RfpDetailContent";

/**
 * Inline-scoped keyframes for the slide-in. Two characters (`dp` for "detail
 * panel") avoid colliding with other components that may also embed a
 * keyframe in a `<style>` block in dev mode (SSR-emitted styles are
 * de-duplicated by content but the name needs to be unique).
 */
const SLIDE_KEYFRAMES = `
@keyframes detailPanelSlideIn {
  from { transform: translateX(20px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
`;

export default function DetailPanel() {
  const { detail, closeDetail } = useViewsRouter();

  // Ref for outside-click detection; we walk up from the click target and
  // bail when the click happened inside the panel itself OR on an element
  // marked with data-row-kind/data-row-id (the canvas's row-click delegate
  // — we let GroupCanvas swap the URL rather than fight it).
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Stable callback so the effect below doesn't re-bind on every render.
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !panelRef.current) return;
      // Click inside the panel — let the panel handle it (button, link, etc.).
      if (panelRef.current.contains(target)) return;
      // Click on a row that should open a different detail kind — let the
      // canvas's event delegation update the URL instead of closing the panel.
      if (target.closest("[data-row-kind][data-row-id]")) return;
      // Click on the panel-host's portal/dialog scrim (if any) — also bail
      // so modals stacked above us continue to swallow clicks normally.
      if (target.closest("[data-detail-panel-ignore]")) return;
      closeDetail();
    },
    [closeDetail],
  );

  // Escape key also closes the panel — common keyboard expectation, and the
  // prototype's user flows include this implicitly. We only attach the
  // listener while the panel is mounted (i.e. detail != null).
  useEffect(() => {
    if (!detail) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDetail();
      }
    };
    // mousedown fires before click; using mousedown lets us close before any
    // bubbling click handler on the canvas runs, preventing spurious URL
    // pushes that would re-open the panel on the same tick.
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [detail, handleOutsideClick, closeDetail]);

  if (!detail) return null;

  return (
    <>
      <style>{SLIDE_KEYFRAMES}</style>
      <div
        ref={panelRef}
        role="complementary"
        aria-label="Detail panel"
        // Keyed on kind+id so React fully unmounts/remounts on entity change.
        // That guarantees content components re-fire their queries cleanly
        // and the slide-in animation replays — matches prototype perception
        // of "new content slid in" without a hand-rolled transition manager.
        key={`${detail.kind}:${detail.id}`}
        className="absolute top-0 right-0 bottom-0 w-[380px] bg-white border-l border-[#D4CFE2] flex flex-col z-30 overflow-hidden"
        style={{
          // Mobile: don't let the panel exceed the viewport — the canvas can
          // be narrower than 380px when the hamburger sidebar is collapsed.
          maxWidth: "calc(100vw - 16px)",
          boxShadow: "-12px 0 32px rgba(64,55,112,0.08)",
          animation:
            "detailPanelSlideIn 250ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <ContentSwitch kind={detail.kind} id={detail.id} onClose={closeDetail} />
      </div>
    </>
  );
}

interface ContentProps {
  id: string;
  onClose: () => void;
}

function ContentSwitch({
  kind,
  id,
  onClose,
}: { kind: DetailKind } & ContentProps): ReactNode {
  switch (kind) {
    case "district":
      return <DistrictDetailContent id={id} onClose={onClose} />;
    case "contact":
      return <ContactDetailContent id={id} onClose={onClose} />;
    case "opp":
      return <OppDetailContent id={id} onClose={onClose} />;
    case "vacancy":
      return <VacancyDetailContent id={id} onClose={onClose} />;
    case "news":
      return <NewsDetailContent id={id} onClose={onClose} />;
    case "rfp":
      return <RfpDetailContent id={id} onClose={onClose} />;
    default: {
      // Exhaustiveness guard — `DetailKind` is a closed union, so this branch
      // is unreachable at runtime; TypeScript ensures we add a case if the
      // union ever grows.
      const _exhaustive: never = kind;
      throw new Error(`Unhandled detail kind: ${String(_exhaustive)}`);
    }
  }
}
