"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, Inbox } from "lucide-react";
import { useActivities } from "@/features/activities/lib/queries";
import {
  useActivitiesChrome,
  deriveActivitiesParams,
} from "@/features/activities/lib/filters-store";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_CONFIG,
  type ActivityType,
  type ActivityStatus,
} from "@/features/activities/types";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import { cn } from "@/features/shared/lib/cn";
import { ACTIVITIES_TABLE_COLUMNS, getColumnDef } from "./columns";
import ActivitiesTableToolbar from "./ActivitiesTableToolbar";

interface ActivitiesTableViewProps {
  onActivityClick: (id: string) => void;
  onNewActivity: () => void;
}

const NARROW_WIDTH_HINT_THRESHOLD = 200;

// Render a typed value into a table cell. Text-fragment fall-throughs are
// fine for now — when 3.3 lands, the editable columns swap their cell out
// for an EditableXCell that handles its own click + popover.
function renderCell(key: string, row: ActivityListItem) {
  switch (key) {
    case "date":
      return row.startDate
        ? new Date(row.startDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : <span className="text-[#A69DC0]">Unscheduled</span>;
    case "type": {
      const label = ACTIVITY_TYPE_LABELS[row.type as ActivityType] ?? row.type;
      return <span className="text-[#544A78] uppercase tracking-wide text-[10px] font-semibold">{label}</span>;
    }
    case "title":
      return <span className="font-medium text-[#403770]">{row.title}</span>;
    case "district":
      return row.districtName ?? <span className="text-[#A69DC0]">—</span>;
    case "contact":
      return row.contactName ?? <span className="text-[#A69DC0]">—</span>;
    case "owner":
      return row.ownerFullName ?? <span className="text-[#A69DC0]">—</span>;
    case "status": {
      const cfg = ACTIVITY_STATUS_CONFIG[row.status as ActivityStatus];
      if (!cfg) return row.status;
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden />
          {cfg.label}
        </span>
      );
    }
    case "outcome":
      return row.outcomePreview ? (
        <span className="text-[#6E6390] truncate block">{row.outcomePreview}</span>
      ) : (
        <span className="text-[#A69DC0]">—</span>
      );
    case "states":
      return (row.stateAbbrevs ?? []).join(", ") || <span className="text-[#A69DC0]">—</span>;
    case "createdAt":
      return <span className="text-[#A69DC0]">—</span>;
    case "inPerson":
      return <span className="text-[#A69DC0]">—</span>;
    default:
      return <span className="text-[#A69DC0]">—</span>;
  }
}

// The Table view body. Owns local row-selection state; reads everything else
// (filters, sort, pagination, visible columns) from useActivitiesChrome so
// switching between calendar views preserves what the user picked.
export default function ActivitiesTableView({
  onActivityClick,
  onNewActivity,
}: ActivitiesTableViewProps) {
  const filters = useActivitiesChrome((s) => s.filters);
  const sorts = useActivitiesChrome((s) => s.tableSorts);
  const visibleColumns = useActivitiesChrome((s) => s.tableVisibleColumns);
  const page = useActivitiesChrome((s) => s.tablePage);
  const pageSize = useActivitiesChrome((s) => s.tablePageSize);
  const setTablePage = useActivitiesChrome((s) => s.setTablePage);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const params = useMemo(
    () =>
      deriveActivitiesParams({
        filters,
        anchorIso: new Date().toISOString(),
        grain: "week",
        view: "table",
        page,
        pageSize,
        sorts,
      }),
    [filters, page, pageSize, sorts]
  );

  const { data, isLoading, isError, refetch } = useActivities(params);
  const rows: ActivityListItem[] = data?.activities ?? [];
  const total = data?.totalInDb ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds]
  );

  const visibleColumnDefs = visibleColumns
    .map(getColumnDef)
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  function togglePageSelection() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        rows.forEach((r) => next.delete(r.id));
      } else {
        rows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      <ActivitiesTableToolbar selectedRows={selectedRows} filteredRows={rows} />

      {total >= NARROW_WIDTH_HINT_THRESHOLD && (
        <div className="flex items-center gap-2 px-6 py-1.5 text-[11px] font-medium text-[#866720] bg-[#fffaf1] border-b border-[#ffd98d]">
          <AlertTriangle className="w-3 h-3" aria-hidden />
          200+ matching — narrow your filters for faster scrolling.
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-[#F7F5FA] border-b border-[#E2DEEC]">
            <tr>
              <th className="w-8 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  aria-label="Select page"
                  checked={allOnPageSelected}
                  onChange={togglePageSelection}
                  className="cursor-pointer accent-[#403770]"
                />
              </th>
              {visibleColumnDefs.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#544A78] whitespace-nowrap"
                  style={col.width ? { minWidth: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFEDF5]">
            {isLoading && rows.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="animate-pulse">
                    <td className="px-3 py-3"><span className="block w-4 h-4 bg-[#EFEDF5] rounded" /></td>
                    {visibleColumnDefs.map((col) => (
                      <td key={col.key} className="px-3 py-3">
                        <span className="block h-3 bg-[#EFEDF5] rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const selected = selectedIds.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onActivityClick(row.id)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selected ? "bg-[#EFEDF5]" : "hover:bg-[#F7F5FA]"
                      )}
                    >
                      <td className="w-8 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.title}`}
                          checked={selected}
                          onChange={() => toggleRow(row.id)}
                          className="cursor-pointer accent-[#403770]"
                        />
                      </td>
                      {visibleColumnDefs.map((col) => (
                        <td
                          key={col.key}
                          className="px-3 py-2.5 text-xs text-[#403770] whitespace-nowrap"
                          style={col.width ? { maxWidth: col.width } : undefined}
                        >
                          {renderCell(col.key, row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && !isError && rows.length === 0 && (
          <EmptyState
            hasFilters={
              filters.text.trim().length > 0 ||
              filters.types.length > 0 ||
              filters.statuses.length > 0 ||
              filters.districts.length > 0 ||
              filters.contactIds.length > 0 ||
              Boolean(filters.dateFrom) ||
              Boolean(filters.dateTo)
            }
            onNewActivity={onNewActivity}
          />
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertTriangle className="w-6 h-6 text-[#F37167] mb-2" aria-hidden />
            <p className="text-sm text-[#544A78] mb-3">Couldn&apos;t load activities.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a]"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        rowCount={rows.length}
        onPageChange={setTablePage}
      />
    </div>
  );
}

function EmptyState({
  hasFilters,
  onNewActivity,
}: {
  hasFilters: boolean;
  onNewActivity: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Inbox className="w-6 h-6 text-[#A69DC0] mb-2" aria-hidden />
        <p className="text-sm text-[#544A78] mb-1">No matches for these filters.</p>
        <p className="text-xs text-[#8A80A8]">Clear filters from the toolbar to see everything.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Inbox className="w-6 h-6 text-[#A69DC0] mb-2" aria-hidden />
      <p className="text-sm text-[#544A78] mb-3">No activities yet — log your first one.</p>
      <button
        type="button"
        onClick={onNewActivity}
        className="px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a]"
      >
        New activity
      </button>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  rowCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rowCount: number;
  onPageChange: (next: number) => void;
}) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = page * pageSize + rowCount;
  return (
    <div className="flex items-center justify-between px-6 py-2 bg-[#F7F5FA] border-t border-[#E2DEEC] text-[11px] text-[#544A78]">
      <span>
        {total === 0 ? "No results" : `${start}–${end} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#D4CFE2] text-[#544A78] bg-white hover:bg-[#EFEDF5] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-semibold text-[#544A78]">
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#D4CFE2] text-[#544A78] bg-white hover:bg-[#EFEDF5] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Re-export the types so consumers can grab them from one place.
export { ACTIVITIES_TABLE_COLUMNS };
