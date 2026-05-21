"use client";

/**
 * SignalDistrictRow — one collapsible district in the Signals accordion.
 *
 * Collapsed header:
 *   chevron · district name (plum when it has signals, muted at 0) ·
 *   per-type count chips (hidden when that type's count is 0) · freshness
 *   (relative age of newestSignalAt + a coral "new" dot when newer than the
 *   user's last visit).
 *
 * 0-signal districts render "No signals", hide the chevron, and are NOT
 * expandable.
 *
 * Expanded: mounts `useDistrictSignals` so it owns its own query (per the
 * conditional-rendering rule — the query only runs while expanded). Shows
 * skeleton item rows while loading, an inline "Couldn't load · Retry" on error,
 * and a "Show more" button within the district when the feed has more pages.
 *
 * `expanded` is controlled by the parent (so expand-all can drive it); the
 * show-more `page` is local state.
 */
import { useState } from "react";
import { ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import type { SignalsSummaryDistrict } from "./queries";
import { useDistrictSignals } from "./queries";
import type { SignalType, SignalWindow } from "@/lib/signals/sql";
import SignalTypeTag from "./SignalTypeTag";
import SignalItemRow from "./SignalItemRow";
import { relativeAge, isNewerThan } from "./relative-date";

interface SignalDistrictRowProps {
  district: SignalsSummaryDistrict;
  types: { vac: boolean; news: boolean; rfp: boolean };
  since: SignalWindow;
  /** Controlled expansion (parent owns the open set for expand-all). */
  expanded: boolean;
  onToggle: (leaid: string) => void;
  /** Last-visit watermark (ms) for the "new" dot, or null on first visit. */
  lastVisitMs: number | null;
}

const TYPE_ORDER: SignalType[] = ["vac", "news", "rfp"];

export default function SignalDistrictRow({
  district,
  types,
  since,
  expanded,
  onToggle,
  lastVisitMs,
}: SignalDistrictRowProps) {
  const [page, setPage] = useState(1);

  const totalCount =
    district.counts.vac + district.counts.news + district.counts.rfp;
  const hasSignals = totalCount > 0;
  const showNewDot = isNewerThan(district.newestSignalAt, lastVisitMs);

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <li className="border-b border-[#EFEDF5]">
      {/* Header row — button so it's keyboard-focusable; non-expandable
          0-signal rows render a non-interactive div instead. */}
      {hasSignals ? (
        <button
          type="button"
          onClick={() => onToggle(district.leaid)}
          aria-expanded={expanded}
          className="w-full flex items-center gap-2 pl-3 pr-4 py-2.5 text-left hover:bg-[#F7F5FA] transition-colors duration-100"
        >
          <Chevron
            className="h-4 w-4 flex-shrink-0 text-[#8A80A8]"
            aria-hidden
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-semibold text-[#403770]">
            {district.name}
          </span>
          <span className="flex flex-shrink-0 items-center gap-1.5">
            {TYPE_ORDER.map((t) =>
              district.counts[t] > 0 ? (
                <span
                  key={t}
                  className="inline-flex flex-shrink-0 items-center"
                  title={`${district.counts[t]} ${t}`}
                >
                  <SignalTypeTag type={t} />
                  <span
                    className="ml-0.5 text-[11px] font-semibold tabular-nums text-[#544A78]"
                  >
                    {district.counts[t]}
                  </span>
                </span>
              ) : null,
            )}
          </span>
          <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-[#8A80A8] tabular-nums">
            {showNewDot && (
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-[#F37167]"
                aria-label="New signals"
              />
            )}
            {relativeAge(district.newestSignalAt)}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 pl-3 pr-4 py-2.5">
          {/* No chevron on a 0-signal district; reserve the indent so names
              align with expandable rows above/below. */}
          <span className="h-4 w-4 flex-shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-medium text-[#8A80A8]">
            {district.name}
          </span>
          <span className="flex-shrink-0 whitespace-nowrap text-[12px] text-[#A69DC0]">
            No signals
          </span>
        </div>
      )}

      {hasSignals && expanded && (
        <ExpandedFeed
          leaid={district.leaid}
          types={types}
          since={since}
          page={page}
          onShowMore={() => setPage((p) => p + 1)}
        />
      )}
    </li>
  );
}

// ── Expanded feed — owns its own per-district query ──────────────────────────

interface ExpandedFeedProps {
  leaid: string;
  types: { vac: boolean; news: boolean; rfp: boolean };
  since: SignalWindow;
  page: number;
  onShowMore: () => void;
}

function ExpandedFeed({
  leaid,
  types,
  since,
  page,
  onShowMore,
}: ExpandedFeedProps) {
  const q = useDistrictSignals({ leaid, types, since, page, enabled: true });

  if (q.isLoading) {
    return (
      <div className="pb-1" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="mx-9 my-1.5 h-7 rounded-md bg-[#F7F5FA] animate-pulse"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="flex items-center gap-2 pl-9 pr-4 py-2.5 text-[12px] text-[#8A80A8]">
        <span className="whitespace-nowrap">Couldn&apos;t load signals</span>
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="inline-flex items-center gap-1 font-semibold text-[#544A78] hover:text-[#403770] transition-colors duration-100"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          <span className="whitespace-nowrap">Retry</span>
        </button>
      </div>
    );
  }

  const items = q.data?.items ?? [];
  const hasMore = q.data?.hasMore ?? false;

  if (items.length === 0) {
    return (
      <div className="pl-9 pr-4 py-2.5 text-[12px] text-[#A69DC0] whitespace-nowrap">
        No signals in this window.
      </div>
    );
  }

  return (
    <div className="pb-1">
      {items.map((item) => (
        <SignalItemRow key={`${item.type}:${item.id}`} item={item} />
      ))}
      {hasMore && (
        <div className="flex pl-9 pr-4 py-2">
          <button
            type="button"
            onClick={onShowMore}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D4CFE2] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#544A78] hover:border-[#403770] hover:text-[#403770] transition-colors duration-100"
          >
            <span className="whitespace-nowrap">Show more</span>
          </button>
        </div>
      )}
    </div>
  );
}
