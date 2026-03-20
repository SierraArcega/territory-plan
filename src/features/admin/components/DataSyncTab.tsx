"use client";

import { useState } from "react";
import { useAdminSync, SyncLogItem } from "../hooks/useAdminSync";
import SyncHealthBanner from "./SyncHealthBanner";
import VacancyScanCard from "./VacancyScanCard";

function relativeTime(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "\u2014";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return remainSecs > 0 ? `${mins}m ${remainSecs}s` : `${mins}m`;
}

// ---------- Icons ----------

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-[#8A80A8] transition-transform duration-150 ${
        expanded ? "rotate-90" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SortArrow({ dir }: { dir: "asc" | "desc" | null }) {
  if (dir === "asc") {
    return (
      <svg className="w-3.5 h-3.5 inline ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    );
  }
  if (dir === "desc") {
    return (
      <svg className="w-3.5 h-3.5 inline ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    );
  }
  // neutral — faint arrow shown on hover only via group-hover
  return (
    <svg className="w-3.5 h-3.5 inline ml-0.5 opacity-0 group-hover/sortcol:opacity-40 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

// ---------- Status badge ----------

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let classes = "px-2 py-0.5 text-xs font-medium rounded-full ";
  if (s === "success") {
    classes += "bg-[#EDFFE3] text-[#5f665b]";
  } else if (s === "error") {
    classes += "bg-[#F37167]/15 text-[#c25a52]";
  } else if (s === "running") {
    classes += "bg-[#6EA3BE]/15 text-[#4d7285]";
  } else {
    classes += "bg-[#EFEDF5] text-[#8A80A8]";
  }
  return <span className={classes}>{status}</span>;
}

// ---------- Sortable columns ----------

type SortableColumn = "dataSource" | "status" | "recordsUpdated" | "recordsFailed" | "startedAt" | "duration";

const columns: { key: SortableColumn; label: string; align?: "right" }[] = [
  { key: "dataSource", label: "Source" },
  { key: "status", label: "Status" },
  { key: "recordsUpdated", label: "Records Updated", align: "right" },
  { key: "recordsFailed", label: "Failed", align: "right" },
  { key: "startedAt", label: "Started" },
  { key: "duration", label: "Duration" },
];

// ---------- Component ----------

export default function DataSyncTab() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading } = useAdminSync({
    page,
    pageSize,
    source,
    status,
    sortBy,
    sortDir,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? { page: 1, pageSize: 20, total: 0 };
  const sources = data?.sources ?? [];
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(col: SortableColumn) {
    if (sortBy === col) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else if (sortDir === "desc") {
        setSortBy("");
        setSortDir("");
      }
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortDirFor(col: SortableColumn): "asc" | "desc" | null {
    if (sortBy !== col) return null;
    return sortDir as "asc" | "desc";
  }

  return (
    <div className="space-y-3">
      <SyncHealthBanner />
      <VacancyScanCard />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          className="border border-[#C2BBD4] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390] bg-white"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="border border-[#C2BBD4] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390] bg-white"
        >
          <option value="">All statuses</option>
          <option value="success">success</option>
          <option value="error">error</option>
          <option value="running">running</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E2DEEC] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F7F5FA] border-b border-[#D4CFE2]">
              {/* Expand column */}
              <th className="w-10 px-3 py-3" />
              {columns.map((col) => {
                const dir = sortDirFor(col.key);
                const isActive = dir !== null;
                return (
                  <th
                    key={col.key}
                    className={`group/sortcol px-4 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${isActive ? "text-[#403770]" : "text-[#8A80A8]"}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortArrow dir={dir} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-sm text-[#8A80A8]">
                  Loading sync logs...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-sm text-[#8A80A8]">
                  No sync logs found.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const isExpanded = expandedRows.has(item.id);
                const hasError = !!item.errorMessage;
                const isLast = idx === items.length - 1;

                return (
                  <RowGroup
                    key={item.id}
                    item={item}
                    isExpanded={isExpanded}
                    hasError={hasError}
                    isLast={isLast}
                    onToggle={() => toggleRow(item.id)}
                  />
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination footer */}
        <div className="bg-[#F7F5FA] border-t border-[#E2DEEC] px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-medium text-[#A69DC0]">
            {pagination.total} sync log{pagination.total !== 1 ? "s" : ""}
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 text-xs font-medium text-[#6E6390] border border-[#C2BBD4] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EFEDF5] transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-[#8A80A8]">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 text-xs font-medium text-[#6E6390] border border-[#C2BBD4] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EFEDF5] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Row group (data row + optional expanded error) ----------

function RowGroup({
  item,
  isExpanded,
  hasError,
  isLast,
  onToggle,
}: {
  item: SyncLogItem;
  isExpanded: boolean;
  hasError: boolean;
  isLast: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`group hover:bg-[#EFEDF5] transition-colors duration-100 ${
          !isLast && !isExpanded ? "border-b border-[#E2DEEC]" : ""
        } ${hasError ? "cursor-pointer" : ""}`}
        onClick={hasError ? onToggle : undefined}
      >
        {/* Chevron */}
        <td className="px-3 py-3">
          {hasError ? (
            <ChevronIcon expanded={isExpanded} />
          ) : (
            <span className="w-4 h-4 block" />
          )}
        </td>

        {/* Source */}
        <td className="px-4 py-3 text-sm font-medium text-[#403770]">
          {item.dataSource}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={item.status} />
        </td>

        {/* Records Updated */}
        <td className="px-4 py-3 text-sm text-[#6E6390] text-right">
          {item.recordsUpdated.toLocaleString()}
        </td>

        {/* Failed */}
        <td
          className={`px-4 py-3 text-sm text-right ${
            item.recordsFailed > 0 ? "text-[#F37167]" : "text-[#A69DC0]"
          }`}
        >
          {item.recordsFailed > 0 ? item.recordsFailed.toLocaleString() : "0"}
        </td>

        {/* Started */}
        <td className="px-4 py-3 text-sm text-[#8A80A8]">
          {relativeTime(item.startedAt)}
        </td>

        {/* Duration */}
        <td className="px-4 py-3 text-sm text-[#6E6390]">
          {formatDuration(item.startedAt, item.completedAt)}
        </td>
      </tr>

      {/* Expanded error row */}
      {isExpanded && hasError && (
        <tr className={!isLast ? "border-b border-[#E2DEEC]" : ""}>
          <td colSpan={columns.length + 1} className="p-0">
            <div className="bg-[#F7F5FA] px-8 py-4 border-l-2 border-[#F37167]">
              <p className="text-sm text-[#c25a52] whitespace-pre-wrap">
                {item.errorMessage}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
