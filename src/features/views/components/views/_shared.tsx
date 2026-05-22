"use client";

/**
 * Shared primitives for all 8 view bodies.
 *
 * - Loading / empty / error states with matching spacing so each view's
 *   chrome stays consistent.
 * - ShowMoreButton for the 50/50 pagination pattern (per CLAUDE.md).
 * - FilterHintBanner shown at 200+ matches to nudge the user to refine.
 * - EventDelegationRow wrapper helpers exposed via data-row-* attrs that
 *   GroupCanvas listens for.
 * - ViewBodyProps — shared prop contract for all view body components
 *   (districts table, contacts, opps, vacancies, news, rfps). GroupCanvas
 *   threads these down so each view body can call useGridLayout internally.
 */
import type { ReactNode } from "react";
import { Filter, RefreshCw, Inbox, AlertTriangle } from "lucide-react";
import type { ViewLayouts } from "@/lib/saved-views/grid-layout-schema";

/**
 * Shared props for all view body components rendered inside GroupCanvas.
 *
 * - `leaids`       — district scope (null = list-scoped, not yet narrowed).
 * - `parentKind`   — "plan" or "list", determines which PATCH route to use.
 * - `parentId`     — the plan or list id, used by useGridLayout for the PATCH.
 * - `savedLayouts` — the full viewLayouts blob from the parent record; null
 *                    when not yet persisted (first visit). The view body passes
 *                    this to useGridLayout, which seeds local state from it.
 */
export interface ViewBodyProps {
  leaids: string[] | null;
  parentKind: "plan" | "list";
  parentId: string;
  savedLayouts: ViewLayouts;
}

export const PAGE_SIZE = 50;
export const FILTER_HINT_THRESHOLD = 200;

/** Wrapper that gives every view body the same scroll/padding behavior. */
export function ViewScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`h-full overflow-auto bg-[#FFFCFA] ${className ?? ""}`}
      // Per CLAUDE.md mobile guidance: pan-y opt-in on iOS for inner scroll.
      style={{ touchAction: "pan-y" }}
    >
      {children}
    </div>
  );
}

export function LoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <ViewScroll>
      <ul className="px-5 py-4 flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: rows }).map((_, i) => (
          <li
            key={i}
            className="h-9 rounded-md bg-[#F7F5FA] animate-pulse"
            aria-hidden
          />
        ))}
      </ul>
    </ViewScroll>
  );
}

export function EmptyState({
  title = "Nothing to show",
  hint,
}: {
  title?: string;
  hint?: string;
}) {
  return (
    <ViewScroll>
      <div className="h-full flex items-center justify-center p-10">
        <div className="text-center max-w-sm">
          <Inbox
            className="w-7 h-7 text-[#A69DC0] mx-auto"
            aria-hidden
            strokeWidth={1.5}
          />
          <h3 className="mt-3 text-[14px] font-semibold text-[#403770] whitespace-nowrap">
            {title}
          </h3>
          {hint && (
            <p className="mt-1 text-[12px] text-[#8A80A8]">{hint}</p>
          )}
        </div>
      </div>
    </ViewScroll>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <ViewScroll>
      <div className="h-full flex items-center justify-center p-10">
        <div className="text-center max-w-sm">
          <AlertTriangle
            className="w-7 h-7 text-[#F37167] mx-auto"
            aria-hidden
            strokeWidth={1.5}
          />
          <h3 className="mt-3 text-[14px] font-semibold text-[#403770] whitespace-nowrap">
            Couldn&apos;t load
          </h3>
          <p className="mt-1 text-[12px] text-[#8A80A8]">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#D4CFE2] bg-white text-[12px] font-semibold text-[#544A78] hover:text-[#403770] hover:border-[#403770] transition-colors duration-100"
            >
              <RefreshCw className="w-3 h-3" aria-hidden />
              <span className="whitespace-nowrap">Retry</span>
            </button>
          )}
        </div>
      </div>
    </ViewScroll>
  );
}

export function ShowMoreButton({
  onClick,
  remaining,
}: {
  onClick: () => void;
  remaining: number;
}) {
  return (
    <div className="flex justify-center px-5 py-4">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#D4CFE2] bg-white text-[12px] font-semibold text-[#544A78] hover:text-[#403770] hover:border-[#403770] transition-colors duration-100"
      >
        <span className="whitespace-nowrap">
          Show more ({Math.min(PAGE_SIZE, remaining)} of {remaining})
        </span>
      </button>
    </div>
  );
}

export function FilterHintBanner({ total }: { total: number }) {
  if (total < FILTER_HINT_THRESHOLD) return null;
  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-[#fffaf1] border-b border-[#ffd98d]">
      <Filter className="w-3.5 h-3.5 text-[#7d6d3a]" aria-hidden />
      <span className="text-[12px] text-[#7d6d3a] whitespace-nowrap">
        {total.toLocaleString()} matches — narrow with a filter to scan faster
      </span>
    </div>
  );
}

/**
 * Hash a leaid array into a stable key string for TanStack Query.
 *
 * Per CLAUDE.md: query keys must be primitives. We JSON.stringify a sorted
 * leaid array so deep-equal scopes share a cache entry.
 */
export function leaidsKey(leaids: string[] | null | undefined): string {
  if (!leaids || leaids.length === 0) return "none";
  // Sort defensively — same set in different orders should hash to the same
  // key so we don't double-fetch.
  return JSON.stringify([...leaids].sort());
}

/** Comma-join leaids for query-string serialization. */
export function leaidsCsv(leaids: string[] | null | undefined): string {
  if (!leaids || leaids.length === 0) return "";
  return leaids.join(",");
}
