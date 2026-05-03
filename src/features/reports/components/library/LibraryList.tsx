"use client";

import { useMemo, useState } from "react";
import type { ReportListItem } from "../../lib/queries";
import { EmptyLibrary } from "./EmptyLibrary";
import { LibraryRow } from "./LibraryRow";

const PAGE_SIZE = 50;
const FILTER_HINT_THRESHOLD = 200;

interface Props {
  rows: ReportListItem[];
  kind: "mine" | "starred" | "team";
  searchQuery: string;
  isAdmin: boolean;
  /** Current user's id — used per-row to decide whether to show the delete
   *  affordance. Reports owned by the current user (or any report when the
   *  user is admin) are deletable. */
  currentUserId: string | null;
  onOpen: (id: number) => void;
  onToggleStar: (id: number, next: boolean) => void;
  onDelete: (id: number, title: string) => void;
  onNewReport: () => void;
}

export function LibraryList({
  rows,
  kind,
  searchQuery,
  isAdmin,
  currentUserId,
  onOpen,
  onToggleStar,
  onDelete,
  onNewReport,
}: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const showOwner = kind === "team" || kind === "starred";

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  if (filtered.length === 0) {
    return <EmptyLibrary kind={kind} onNewReport={onNewReport} />;
  }

  const slice = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;
  const showFilterHint = filtered.length > FILTER_HINT_THRESHOLD;

  return (
    <div className="space-y-2">
      {showFilterHint && (
        <div className="rounded-lg border border-[#FFCF70] bg-[#fffaf1] px-3 py-2 text-[11.5px] text-[#997c43]">
          {filtered.length.toLocaleString()} reports match — try narrowing your search.
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-[#D4CFE2] bg-white">
        {slice.map((r, i) => (
          <div
            key={r.id}
            className={i === slice.length - 1 ? "" : "border-b border-[#E2DEEC]"}
          >
            <LibraryRow
              report={r}
              showOwner={showOwner}
              isAdmin={isAdmin}
              canDelete={isAdmin || (!!currentUserId && r.owner?.id === currentUserId)}
              onOpen={onOpen}
              onToggleStar={onToggleStar}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-lg border border-[#D4CFE2] bg-white px-3.5 py-1.5 text-xs font-medium text-[#544A78] transition-colors hover:bg-[#F7F5FA]"
          >
            <span className="whitespace-nowrap">
              Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
