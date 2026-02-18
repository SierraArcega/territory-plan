"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateDistrictEdits,
  useUsers,
  useTags,
  useAddDistrictTag,
  useRemoveDistrictTag,
  useCreateTag,
  useTerritoryPlans,
  useAddDistrictsToPlan,
  useRemoveDistrictFromPlan,
  type TerritoryPlan,
} from "@/lib/api";
import { districtColumns } from "./columns/districtColumns";
import { activityColumns } from "./columns/activityColumns";
import { taskColumns } from "./columns/taskColumns";
import { contactColumns } from "./columns/contactColumns";
import { planColumns } from "./columns/planColumns";

// ---- Types ----

interface Props {
  data: Record<string, unknown>[];
  visibleColumns: string[];
  sorts: { column: string; direction: "asc" | "desc" }[];
  onSort: (column: string) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
  isLoading: boolean;
  pagination: { page: number; pageSize: number; total: number } | undefined;
  onPageChange: (page: number) => void;
  entityType: string;
  // Selection
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectPage?: (ids: string[]) => void;
  onClearSelection?: () => void;
  // Column reordering
  onReorderColumns?: (columns: string[]) => void;
}

// ---- Column label lookup ----
// Build a map from key -> label across all entity column defs.

const ALL_COLUMN_DEFS = [
  ...districtColumns,
  ...activityColumns,
  ...taskColumns,
  ...contactColumns,
  ...planColumns,
];

const LABEL_MAP: Record<string, string> = {};
for (const col of ALL_COLUMN_DEFS) {
  LABEL_MAP[col.key] = col.label;
}

/**
 * Generate a readable label from a camelCase or snake_case key.
 * Prefers the pre-defined label from column defs if available.
 */
function columnLabel(key: string): string {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  // camelCase -> "Camel Case"
  const spaced = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ---- Cell formatting ----

const CURRENCY_KEYS = /revenue|pipeline|booking|value|take|closed_won/i;
const PERCENT_KEYS = /percent|rate|proficiency/i;
const TAG_COLUMNS = new Set(["tags", "planNames"]);

function renderColoredPills(items: { name: string; color: string }[]) {
  if (items.length === 0) return <span className="text-gray-300">{"\u2014"}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight"
          style={{
            backgroundColor: item.color + "18",
            color: item.color,
            border: `1px solid ${item.color}30`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          {item.name}
        </span>
      ))}
    </span>
  );
}

function formatCellValue(value: unknown, key: string): string {
  if (value == null) return "\u2014";

  // Booleans
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Arrays (e.g. tags: [{name: "..."}])
  if (Array.isArray(value)) {
    if (value.length === 0) return "\u2014";
    return value
      .map((item) =>
        typeof item === "object" && item !== null && "name" in item
          ? (item as { name: string }).name
          : String(item)
      )
      .join(", ");
  }

  // Dates (ISO strings)
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }

  // Numbers
  if (typeof value === "number") {
    if (PERCENT_KEYS.test(key)) {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (CURRENCY_KEYS.test(key)) {
      if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  }

  return String(value);
}

// ---- Editable cell components ----
// Each manages its own editing state so the column useMemo doesn't
// need to rebuild on every keystroke.

const TAG_COLORS = ["#403770", "#F37167", "#6EA3BE", "#8AA891", "#D4A84B", "#9B59B6", "#E67E22"];

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [active, ref, onClose]);
}

function EditableOwnerCell({
  value,
  rowId,
  onSave,
  users,
}: {
  value: unknown;
  rowId: string;
  onSave: (rowId: string, column: string, value: string) => void;
  users: { id: string; fullName: string | null; email: string }[] | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setIsOpen(false); setSearch(""); }, []);
  useOutsideClick(ref, close, isOpen);

  const filtered = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => (u.fullName || u.email).toLowerCase().includes(q));
  }, [users, search]);

  return (
    <div className="relative" ref={ref}>
      <span
        className="group/cell cursor-pointer inline-flex items-center gap-1 px-1 -mx-1 py-0.5 -my-0.5 rounded border border-transparent hover:border-dashed hover:border-plum/30 hover:bg-plum/5 transition-all"
        onClick={(e) => { e.stopPropagation(); setIsOpen((o) => !o); }}
      >
        {value ? (
          <span className="text-[13px] text-gray-600">{String(value)}</span>
        ) : (
          <span className="text-[13px] text-gray-300">assign owner</span>
        )}
        <svg className="shrink-0 opacity-0 group-hover/cell:opacity-50 w-3 h-3 text-[#403770]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6L8 10L12 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      {isOpen && (
        <div className="absolute z-30 top-full mt-1 left-0 w-52 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-2 pt-2 pb-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users\u2026"
              autoFocus
              className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#403770]/30 focus:border-[#403770]/40"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              onClick={(e) => { e.stopPropagation(); onSave(rowId, "owner", ""); close(); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                !value ? "text-[#403770] font-medium bg-[#403770]/5" : "text-gray-400 italic hover:bg-gray-50"
              }`}
            >
              {"\u2014"} Unassigned {"\u2014"}
            </button>
            {filtered.map((u) => {
              const display = u.fullName || u.email;
              const selected = String(value) === display;
              return (
                <button
                  key={u.id}
                  onClick={(e) => { e.stopPropagation(); onSave(rowId, "owner", display); close(); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                    selected ? "text-[#403770] font-medium bg-[#403770]/5" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {display}
                </button>
              );
            })}
            {filtered.length === 0 && search.trim() && (
              <div className="px-3 py-2 text-[10px] text-gray-400 italic">
                {"No users matching \u201c"}{search}{"\u201d"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditableTextCell({
  value,
  rowId,
  column,
  onSave,
}: {
  value: unknown;
  rowId: string;
  column: string;
  onSave: (rowId: string, column: string, value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const startEditing = () => {
    setEditValue(String(value || ""));
    setIsEditing(true);
  };

  const save = () => {
    onSave(rowId, column, editValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        className="w-full px-2 py-1 text-[13px] border border-[#403770]/30 rounded-md outline-none focus:ring-1 focus:ring-[#403770]/40 text-gray-700"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setIsEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="group/cell cursor-text inline-flex items-center gap-1 px-1 -mx-1 py-0.5 -my-0.5 rounded border border-transparent hover:border-dashed hover:border-plum/30 hover:bg-plum/5 transition-all"
      onClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
    >
      {formatCellValue(value, column) || <span className="text-[13px] text-gray-300">click to edit</span>}
      <svg className="shrink-0 opacity-0 group-hover/cell:opacity-50 w-3 h-3 text-[#403770]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// ---- Inline tag editing ----

function EditableTagsCell({ tags: serverTags, rowId }: { tags: { id: number; name: string; color: string }[]; rowId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setIsOpen(false); setSearch(""); }, []);
  useOutsideClick(ref, close, isOpen);

  const { data: allTags } = useTags();
  const addTag = useAddDistrictTag();
  const removeTag = useRemoveDistrictTag();
  const createTag = useCreateTag();

  // Optimistic state — show changes immediately, reconcile when server data arrives
  const [optimisticAdds, setOptimisticAdds] = useState<number[]>([]);
  const [optimisticRemoves, setOptimisticRemoves] = useState<number[]>([]);
  const serverTagRef = useRef(serverTags);
  if (serverTagRef.current !== serverTags) {
    serverTagRef.current = serverTags;
    // Server data arrived — clear optimistic state
    if (optimisticAdds.length > 0) setOptimisticAdds([]);
    if (optimisticRemoves.length > 0) setOptimisticRemoves([]);
  }

  const displayTags = useMemo(() => {
    let tags = serverTags.filter((t) => !optimisticRemoves.includes(t.id));
    const added = (allTags || []).filter((t) => optimisticAdds.includes(t.id) && !serverTags.some((st) => st.id === t.id));
    return [...tags, ...added];
  }, [serverTags, optimisticAdds, optimisticRemoves, allTags]);

  const displayIds = useMemo(() => new Set(displayTags.map((t) => t.id)), [displayTags]);

  const available = useMemo(() => {
    const pool = (allTags || []).filter((t) => !displayIds.has(t.id));
    if (!search.trim()) return pool;
    const q = search.toLowerCase();
    return pool.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, displayIds, search]);

  const handleAdd = (tagId: number) => {
    setOptimisticAdds((prev) => [...prev, tagId]);
    addTag.mutate({ leaid: rowId, tagId });
  };
  const handleRemove = (tagId: number) => {
    setOptimisticRemoves((prev) => [...prev, tagId]);
    removeTag.mutate({ leaid: rowId, tagId });
  };

  const handleCreate = async () => {
    if (!search.trim()) return;
    const color = TAG_COLORS[displayTags.length % TAG_COLORS.length];
    try {
      const newTag = await createTag.mutateAsync({ name: search.trim(), color });
      setOptimisticAdds((prev) => [...prev, newTag.id]);
      addTag.mutate({ leaid: rowId, tagId: newTag.id });
      setSearch("");
    } catch { /* tag name may already exist */ }
  };

  const exactMatch = search.trim() && (allTags || []).some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex flex-wrap items-center gap-1">
        {displayTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight"
            style={{ backgroundColor: tag.color + "18", color: tag.color, border: `1px solid ${tag.color}30` }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
            {tag.name}
            <button
              onClick={() => handleRemove(tag.id)}
              className="ml-0.5 rounded-full hover:bg-black/10 p-px transition-colors"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M2 2L6 6M6 2L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="inline-flex items-center px-1 py-0.5 rounded text-[10px] text-gray-400 hover:text-[#403770] hover:bg-[#403770]/5 border border-dashed border-gray-200 hover:border-[#403770]/30 transition-colors"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </span>

      {isOpen && (
        <div className="absolute z-30 top-full mt-1 left-0 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-2 pt-2 pb-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={"Search or create tag\u2026"}
              autoFocus
              className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#403770]/30 focus:border-[#403770]/40"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim() && available.length === 0 && !exactMatch) handleCreate();
              }}
            />
          </div>
          <div className="max-h-40 overflow-y-auto py-1">
            {available.map((tag) => (
              <button
                key={tag.id}
                onClick={(e) => { e.stopPropagation(); handleAdd(tag.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
            {search.trim() && !exactMatch && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCreate(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#403770] hover:bg-[#403770]/5 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {"Create \u201c"}{search.trim()}{"\u201d"}
              </button>
            )}
            {available.length === 0 && !search.trim() && (
              <div className="px-3 py-2 text-[10px] text-gray-400 italic">No more tags to add</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Inline plan editing ----

function EditablePlansCell({ plans: serverPlans, rowId }: { plans: { id: string; name: string; color: string }[]; rowId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setIsOpen(false); setSearch(""); }, []);
  useOutsideClick(ref, close, isOpen);

  const { data: allPlans } = useTerritoryPlans();
  const addToPlan = useAddDistrictsToPlan();
  const removeFromPlan = useRemoveDistrictFromPlan();

  // Optimistic state — show changes immediately, reconcile when server data arrives
  const [optimisticAdds, setOptimisticAdds] = useState<string[]>([]);
  const [optimisticRemoves, setOptimisticRemoves] = useState<string[]>([]);
  const serverPlanRef = useRef(serverPlans);
  if (serverPlanRef.current !== serverPlans) {
    serverPlanRef.current = serverPlans;
    if (optimisticAdds.length > 0) setOptimisticAdds([]);
    if (optimisticRemoves.length > 0) setOptimisticRemoves([]);
  }

  const displayPlans = useMemo(() => {
    let plans = serverPlans.filter((p) => !optimisticRemoves.includes(p.id));
    const added = (allPlans || [])
      .filter((p: TerritoryPlan) => optimisticAdds.includes(p.id) && !serverPlans.some((sp) => sp.id === p.id))
      .map((p: TerritoryPlan) => ({ id: p.id, name: p.name, color: p.color }));
    return [...plans, ...added];
  }, [serverPlans, optimisticAdds, optimisticRemoves, allPlans]);

  const displayIds = useMemo(() => new Set(displayPlans.map((p) => p.id)), [displayPlans]);

  const available = useMemo(() => {
    const pool = (allPlans || []).filter((p: TerritoryPlan) => !displayIds.has(p.id));
    if (!search.trim()) return pool;
    const q = search.toLowerCase();
    return pool.filter((p: TerritoryPlan) => p.name.toLowerCase().includes(q));
  }, [allPlans, displayIds, search]);

  const handleAdd = (planId: string) => {
    setOptimisticAdds((prev) => [...prev, planId]);
    addToPlan.mutate({ planId, leaids: rowId });
  };
  const handleRemove = (planId: string) => {
    setOptimisticRemoves((prev) => [...prev, planId]);
    removeFromPlan.mutate({ planId, leaid: rowId });
  };

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex flex-wrap items-center gap-1">
        {displayPlans.map((plan) => (
          <span
            key={plan.id}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight"
            style={{ backgroundColor: plan.color + "18", color: plan.color, border: `1px solid ${plan.color}30` }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
            {plan.name}
            <button
              onClick={() => handleRemove(plan.id)}
              className="ml-0.5 rounded-full hover:bg-black/10 p-px transition-colors"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M2 2L6 6M6 2L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="inline-flex items-center px-1 py-0.5 rounded text-[10px] text-gray-400 hover:text-[#403770] hover:bg-[#403770]/5 border border-dashed border-gray-200 hover:border-[#403770]/30 transition-colors"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </span>

      {isOpen && (
        <div className="absolute z-30 top-full mt-1 left-0 w-52 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-2 pt-2 pb-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={"Search plans\u2026"}
              autoFocus
              className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#403770]/30 focus:border-[#403770]/40"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {(available as TerritoryPlan[]).map((plan) => (
              <button
                key={plan.id}
                onClick={(e) => { e.stopPropagation(); handleAdd(plan.id); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                <span className="flex-1 truncate">{plan.name}</span>
                <span className="text-[9px] text-gray-400">{plan.districtCount}d</span>
              </button>
            ))}
            {(available as TerritoryPlan[]).length === 0 && (
              <div className="px-3 py-2 text-[10px] text-gray-400 italic">
                {search.trim() ? "No matching plans" : "Already in all plans"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Component ----

export default function ExploreTable({
  data,
  visibleColumns,
  sorts,
  onSort,
  onRowClick,
  isLoading,
  pagination,
  onPageChange,
  entityType,
  selectedIds,
  onToggleSelect,
  onSelectPage,
  onClearSelection,
  onReorderColumns,
}: Props) {
  const showCheckboxes = entityType === "districts" && !!selectedIds;

  // Column drag-to-reorder state
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dropColIdx, setDropColIdx] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const updateEdits = useUpdateDistrictEdits();
  const { data: users } = useUsers();

  // Stable save handler — each editable cell component manages its own editing
  // state, then calls this when done
  const handleSave = useCallback((rowId: string, column: string, value: string) => {
    updateEdits.mutate(
      {
        leaid: rowId,
        [column]: value || undefined,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["explore"] });
        },
      }
    );
  }, [updateEdits, queryClient]);

  // Column drag handlers
  const handleColDragStart = useCallback((idx: number) => { setDragColIdx(idx); }, []);
  const handleColDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropColIdx(idx);
  }, []);
  const handleColDragEnd = useCallback(() => {
    setDragColIdx(null);
    setDropColIdx(null);
  }, []);
  const handleColDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragColIdx === null || dragColIdx === targetIdx || !onReorderColumns) {
      setDragColIdx(null);
      setDropColIdx(null);
      return;
    }
    const newOrder = [...visibleColumns];
    const [moved] = newOrder.splice(dragColIdx, 1);
    newOrder.splice(targetIdx, 0, moved);
    onReorderColumns(newOrder);
    setDragColIdx(null);
    setDropColIdx(null);
  }, [dragColIdx, visibleColumns, onReorderColumns]);

  const [expandedPlanIds, setExpandedPlanIds] = useState<Set<string>>(new Set());
  const togglePlanExpand = useCallback((id: string) => {
    setExpandedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const isPlanEntity = entityType === "plans";

  // Checkbox helpers
  const pageIds = useMemo(
    () => data.map((row) => (row.leaid || row.id) as string),
    [data]
  );
  const allPageSelected = showCheckboxes && pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = showCheckboxes && pageIds.some((id) => selectedIds.has(id));

  // Build TanStack column definitions from visible column keys.
  // Editable cells render small wrapper components that manage their OWN
  // editing state, so the column memo does NOT depend on editingCell/editValue.
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const dataCols: ColumnDef<Record<string, unknown>>[] = visibleColumns.map((key) => {
      const colDef = districtColumns.find((d) => d.key === key);
      const isEditable = entityType === "districts" && colDef?.editable;
      const isOwner = key === "owner";

      // Determine cell renderer
      const isTagColumn = TAG_COLUMNS.has(key);
      const isDistricts = entityType === "districts";

      let cellRenderer;
      if (isEditable) {
        cellRenderer = (info: { getValue: () => unknown; row: { original: Record<string, unknown> } }) => {
          const value = info.getValue();
          const rowId = (info.row.original.leaid || info.row.original.id) as string;
          if (isOwner) {
            return <EditableOwnerCell value={value} rowId={rowId} onSave={handleSave} users={users} />;
          }
          return <EditableTextCell value={value} rowId={rowId} column={key} onSave={handleSave} />;
        };
      } else if (isTagColumn && isDistricts) {
        if (key === "tags") {
          cellRenderer = (info: { row: { original: Record<string, unknown> } }) => {
            const rowId = (info.row.original.leaid || info.row.original.id) as string;
            const tags = (info.row.original.tags || []) as { id: number; name: string; color: string }[];
            return <EditableTagsCell tags={tags} rowId={rowId} />;
          };
        } else {
          // planNames
          cellRenderer = (info: { row: { original: Record<string, unknown> } }) => {
            const rowId = (info.row.original.leaid || info.row.original.id) as string;
            const plans = (info.row.original.planNames || []) as { id: string; name: string; color: string }[];
            return <EditablePlansCell plans={plans} rowId={rowId} />;
          };
        }
      } else if (isTagColumn) {
        cellRenderer = (info: { getValue: () => unknown }) => {
          const value = info.getValue();
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null && "color" in value[0]) {
            return renderColoredPills(value as { name: string; color: string }[]);
          }
          return formatCellValue(value, key);
        };
      } else {
        cellRenderer = (info: { getValue: () => unknown }) => formatCellValue(info.getValue(), key);
      }

      return {
        id: key,
        accessorFn: (row: Record<string, unknown>) => row[key],
        header: () => columnLabel(key),
        cell: cellRenderer,
      };
    });

    if (showCheckboxes) {
      dataCols.unshift({
        id: "__select",
        header: () => null, // header checkbox rendered manually
        cell: () => null, // cell checkbox rendered manually
        size: 40,
      });
    }

    if (isPlanEntity) {
      dataCols.unshift({
        id: "__expand",
        header: () => null,
        cell: () => null,
        size: 36,
      });
    }

    return dataCols;
  }, [visibleColumns, entityType, showCheckboxes, isPlanEntity, handleSave, users]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  // Pagination math
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 50;
  const total = pagination?.total ?? 0;
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Determine if a column should show the "name" styling (primary column)
  const primaryColumn = visibleColumns[0];

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable table area */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-200">
                {headerGroup.headers.map((header) => {
                  const colKey = header.column.id;

                  // Expand header (plans only — empty spacer)
                  if (colKey === "__expand") {
                    return (
                      <th
                        key={header.id}
                        className="w-9 bg-gray-50/80 sticky top-0 z-10"
                      />
                    );
                  }

                  // Checkbox header
                  if (colKey === "__select") {
                    return (
                      <th
                        key={header.id}
                        className="w-10 px-3 py-3 bg-gray-50/80 sticky top-0 z-10"
                      >
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = somePageSelected && !allPageSelected;
                          }}
                          onChange={() => {
                            if (allPageSelected) {
                              onClearSelection?.();
                            } else {
                              onSelectPage?.(pageIds);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30 cursor-pointer"
                        />
                      </th>
                    );
                  }

                  const sortRule = sorts.find((s) => s.column === colKey);
                  const isSorted = !!sortRule;
                  const dataColIdx = visibleColumns.indexOf(colKey);
                  const isDragging = dragColIdx === dataColIdx;
                  const isDropTarget = dropColIdx === dataColIdx && dragColIdx !== null && dragColIdx !== dataColIdx;
                  return (
                    <th
                      key={header.id}
                      draggable={!!onReorderColumns}
                      onDragStart={() => handleColDragStart(dataColIdx)}
                      onDragOver={(e) => handleColDragOver(e, dataColIdx)}
                      onDragEnd={handleColDragEnd}
                      onDrop={(e) => handleColDrop(e, dataColIdx)}
                      className={`px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50/80 sticky top-0 z-10 cursor-pointer select-none hover:text-[#403770] transition-colors duration-100 ${
                        onReorderColumns ? "cursor-grab active:cursor-grabbing" : ""
                      } ${isDragging ? "opacity-40" : ""} ${isDropTarget ? "border-l-2 border-l-[#403770]" : ""}`}
                      onClick={() => onSort(colKey)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {isSorted && (
                          <span className="text-[#403770] font-bold text-xs">
                            {sortRule.direction === "asc" ? "\u2191" : "\u2193"}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {isLoading &&
              Array.from({ length: 10 }).map((_, rowIdx) => (
                <tr key={`skel-${rowIdx}`} className={rowIdx < 9 ? "border-b border-gray-100" : ""}>
                  {showCheckboxes && (
                    <td className="w-10 px-3 py-3">
                      <div className="h-3.5 w-3.5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td key={col} className="px-4 py-3">
                      <div className="h-4 bg-[#C4E7E6]/20 rounded animate-pulse" style={{ width: `${55 + Math.random() * 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))}

            {/* Empty state */}
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + (showCheckboxes ? 1 : 0) + (isPlanEntity ? 1 : 0)} className="py-16">
                  <div className="flex flex-col items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-gray-300">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span className="text-lg font-medium text-gray-600 mb-2">No results found</span>
                    <span className="text-sm text-gray-500 max-w-sm text-center">Try adjusting your filters or search criteria</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!isLoading &&
              table.getRowModel().rows.map((row, rowIdx) => {
                const isLast = rowIdx === table.getRowModel().rows.length - 1;
                const rowId = (row.original.leaid || row.original.id) as string;
                const isSelected = showCheckboxes && selectedIds.has(rowId);
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={`group cursor-pointer transition-colors duration-100 ${!isLast ? "border-b border-gray-100" : ""} ${
                        isSelected ? "bg-[#403770]/[0.04]" : "hover:bg-gray-50/70"
                      }`}
                      onClick={() => onRowClick?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => {
                        // Checkbox cell
                        if (cell.column.id === "__select") {
                          return (
                            <td key={cell.id} className="w-10 px-3 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  onToggleSelect?.(rowId);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30 cursor-pointer"
                              />
                            </td>
                          );
                        }

                        // Expand chevron cell (plans only)
                        if (cell.column.id === "__expand") {
                          const isExpanded = expandedPlanIds.has(rowId);
                          return (
                            <td key={cell.id} className="w-9 px-2 py-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); togglePlanExpand(rowId); }}
                                className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                              >
                                <svg
                                  width="12" height="12" viewBox="0 0 16 16" fill="none"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                  className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                >
                                  <path d="M6 4L10 8L6 12" />
                                </svg>
                              </button>
                            </td>
                          );
                        }

                        const isPrimary = cell.column.id === primaryColumn;
                        const isInteractive = TAG_COLUMNS.has(cell.column.id) || cell.column.id === "owner";
                        return (
                          <td
                            key={cell.id}
                            className={`px-4 py-3 ${isInteractive ? "whitespace-normal overflow-visible" : "whitespace-nowrap max-w-[240px] truncate"} ${
                              isPrimary
                                ? "text-sm font-medium text-[#403770]"
                                : "text-[13px] text-gray-600"
                            }`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                    {isPlanEntity && expandedPlanIds.has(rowId) && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={visibleColumns.length + 1} className="px-0 py-0">
                          <div className="px-10 py-3">
                            <table className="w-full text-[12px]">
                              <thead>
                                <tr className="text-left text-gray-400 uppercase tracking-wider">
                                  <th className="pb-2 font-semibold">District</th>
                                  <th className="pb-2 font-semibold text-right">Renewal</th>
                                  <th className="pb-2 font-semibold text-right">Expansion</th>
                                  <th className="pb-2 font-semibold text-right">Win Back</th>
                                  <th className="pb-2 font-semibold text-right">New Business</th>
                                  <th className="pb-2 font-semibold">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {((row.original._districts as Array<{
                                  leaid: string; name: string;
                                  renewalTarget: number; expansionTarget: number;
                                  winbackTarget: number; newBusinessTarget: number;
                                  notes: string | null;
                                }>) || []).map((d) => (
                                  <tr key={d.leaid} className="border-t border-gray-100">
                                    <td className="py-1.5 text-[#403770] font-medium">{d.name}</td>
                                    <td className="py-1.5 text-right text-gray-600">{d.renewalTarget ? `$${d.renewalTarget.toLocaleString()}` : "\u2014"}</td>
                                    <td className="py-1.5 text-right text-gray-600">{d.expansionTarget ? `$${d.expansionTarget.toLocaleString()}` : "\u2014"}</td>
                                    <td className="py-1.5 text-right text-gray-600">{d.winbackTarget ? `$${d.winbackTarget.toLocaleString()}` : "\u2014"}</td>
                                    <td className="py-1.5 text-right text-gray-600">{d.newBusinessTarget ? `$${d.newBusinessTarget.toLocaleString()}` : "\u2014"}</td>
                                    <td className="py-1.5 text-gray-500 max-w-[200px] truncate">{d.notes || "\u2014"}</td>
                                  </tr>
                                ))}
                                {(!row.original._districts || (row.original._districts as unknown[]).length === 0) && (
                                  <tr>
                                    <td colSpan={6} className="py-3 text-center text-gray-400 italic">
                                      No districts in this plan
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="bg-gray-50/60 border-t border-gray-100 px-4 py-2.5 flex items-center justify-between shrink-0">
        <span className="text-[12px] font-medium text-gray-400 tracking-wide">
          {total === 0
            ? "No results"
            : `Showing ${startRow.toLocaleString()}\u2013${endRow.toLocaleString()} of ${total.toLocaleString()}`}
        </span>

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-[#403770] hover:border-gray-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-[12px] text-gray-400 font-medium tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-[#403770] hover:border-gray-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
