"use client";

// Lead table — driven by the SHARED toolbar sort state (ColumnSort[]).
// Clicking a column header sets that column as the SOLE sort (toggling
// direction if it's already primary) by writing the same `sorts` array the
// toolbar SortDropdown edits, so the two are one system. The incoming `leads`
// are already filtered + sorted by LeadsView.
//
// Built as a lean fixed-layout table rather than on shared DataGrid: the grid
// brings its own header styling, column manager, selection and pagination
// footer — none of which match the handoff §4 pixels — and its sort model
// (Shift+click multi-sort) differs from the sole-sort header behavior the
// handoff specifies. Eight static columns don't need its machinery.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import UserAvatar from "@/features/shared/components/UserAvatar";
import { fmtDate } from "@/features/shared/lib/date-utils";
import type { ColumnSort } from "@/features/shared/components/filters/filter-builder-utils";
import { RENDER_PAGE_SIZE } from "@/features/leads/lib/queries";
import type { Lead } from "@/features/leads/lib/types";
import StatusBadge from "./bits/StatusBadge";
import LeadTypeBadge from "./bits/LeadTypeBadge";
import SlaBadge from "./bits/SlaBadge";
import ScorePill from "./bits/ScorePill";

// Column keys match lib/filter-columns.ts so header clicks and the toolbar
// SortDropdown address the same sort fields.
const TBL_COLS = [
  { key: "name", label: "Lead", w: "22%" },
  { key: "org", label: "District", w: "18%" },
  { key: "state", label: "Location", w: "11%" },
  { key: "score", label: "Score", w: "8%", num: true },
  { key: "type", label: "Type", w: "10%" },
  { key: "status", label: "Status", w: "12%" },
  { key: "bdr", label: "Assigned BDR", w: "11%" },
  { key: "created", label: "Created", w: "8%" },
] as const;

/** Columns that read best newest/highest-first on the first click. */
const DESC_FIRST = new Set(["score", "created"]);

interface LeadsTableProps {
  leads: Lead[];
  selectedId: string | null;
  onSelectLead: (lead: Lead) => void;
  sorts: ColumnSort[];
  onSortsChange: (sorts: ColumnSort[]) => void;
  /** Current user's profile id — renders "You" in the BDR column. */
  currentUserId?: string | null;
  /** Injectable clock for tests. */
  now?: Date;
}

export default function LeadsTable({
  leads,
  selectedId,
  onSelectLead,
  sorts,
  onSortsChange,
  currentUserId,
  now,
}: LeadsTableProps) {
  const [visible, setVisible] = useState(RENDER_PAGE_SIZE);
  const primary = sorts[0] ?? null;

  const onSort = (key: string) => {
    if (primary && primary.key === key) {
      onSortsChange([{ key, dir: primary.dir === "asc" ? "desc" : "asc" }]);
    } else {
      onSortsChange([{ key, dir: DESC_FIRST.has(key) ? "desc" : "asc" }]);
    }
  };

  const shown = leads.slice(0, visible);

  return (
    <div className="overflow-x-auto rounded-lg border border-[#D4CFE2] bg-white">
      <table className="w-full min-w-[760px] border-collapse" style={{ tableLayout: "fixed" }}>
        <colgroup>
          {TBL_COLS.map((c) => (
            <col key={c.key} style={{ width: c.w }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-[#E2DEEC] bg-[#F7F5FA]">
            {TBL_COLS.map((c) => {
              const active = primary?.key === c.key;
              const num = "num" in c && c.num;
              return (
                <th
                  key={c.key}
                  onClick={() => onSort(c.key)}
                  aria-sort={
                    active ? (primary!.dir === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={`cursor-pointer select-none whitespace-nowrap px-4 py-[11px] text-[10.5px] font-bold uppercase tracking-[0.07em] ${
                    num ? "text-right" : "text-left"
                  } ${active ? "text-[#403770]" : "text-[#6E6390]"}`}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${num ? "flex-row-reverse" : ""}`}
                  >
                    {c.label}
                    <span className={`inline-flex ${active ? "opacity-100" : "opacity-25"}`}>
                      {active && primary!.dir === "asc" ? (
                        <ChevronUp size={13} aria-hidden />
                      ) : (
                        <ChevronDown size={13} aria-hidden />
                      )}
                    </span>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((l, i) => {
            const sel = l.id === selectedId;
            const location = [l.district?.city, l.district?.stateAbbrev]
              .filter(Boolean)
              .join(", ");
            return (
              <tr
                key={l.id}
                onClick={() => onSelectLead(l)}
                className={`cursor-pointer transition-colors duration-[110ms] ease-out ${
                  i === 0 ? "" : "border-t border-[#EFEDF5]"
                } ${sel ? "bg-[#FBF1F0]" : "hover:bg-[#F7F5FA]"}`}
              >
                <td className="px-4 py-3">
                  <div className="truncate whitespace-nowrap text-[13.5px] font-semibold text-[#403770]">
                    {l.contact?.name}
                  </div>
                  <div className="mt-px truncate whitespace-nowrap text-[11.5px] text-[#8A80A8]">
                    {l.contact?.title}
                  </div>
                </td>
                <td className="truncate whitespace-nowrap px-4 py-3 text-[13px] text-[#5C5277]">
                  {l.district?.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#5C5277]">
                  {location}
                </td>
                <td className="px-4 py-3 text-right">
                  <ScorePill score={l.score} />
                </td>
                <td className="px-4 py-3">
                  <LeadTypeBadge type={l.leadType} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={l.status} size="sm" />
                  {l.status === "new" && l.assignedAt && (
                    <div className="mt-[5px]">
                      <SlaBadge assignedAt={l.assignedAt} compact now={now} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {l.assignedBdr ? (
                    <span className="inline-flex items-center gap-[7px]">
                      <UserAvatar
                        name={l.assignedBdr.fullName}
                        avatarUrl={l.assignedBdr.avatarUrl}
                        size={22}
                      />
                      <span className="truncate whitespace-nowrap text-[12.5px] text-[#5C5277]">
                        {l.assignedBdr.id === currentUserId
                          ? "You"
                          : (l.assignedBdr.fullName ?? "").split(" ")[0] || "—"}
                      </span>
                    </span>
                  ) : (
                    <span className="whitespace-nowrap text-xs text-[#C2BBD4]">
                      Unassigned
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-[#9E97B8]">
                  {fmtDate(new Date(l.createdAt), now)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {leads.length === 0 && (
        <div className="px-4 py-12 text-center text-[13px] text-[#8A80A8]">
          No leads match these filters.
        </div>
      )}
      {leads.length > visible && (
        <div className="border-t border-[#EFEDF5] p-2.5 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + RENDER_PAGE_SIZE)}
            className="whitespace-nowrap rounded-lg border border-[#D4CFE2] bg-white px-3.5 py-2 text-xs font-semibold text-[#403770] hover:bg-[#F7F5FA]"
          >
            Show {Math.min(RENDER_PAGE_SIZE, leads.length - visible)} more
          </button>
        </div>
      )}
    </div>
  );
}
