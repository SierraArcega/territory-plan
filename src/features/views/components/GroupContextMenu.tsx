"use client";

/**
 * GroupContextMenu — popover triggered by the ⋯ button on a Plan/List row.
 *
 * The popover anchors below the trigger and right-aligns to it. Closes on
 * outside click, Escape, or any menu-item click. The "open" state is owned
 * by the views store's `menuGroupId` slice (single open menu at a time);
 * that key is namespaced to the row's group id so toggling between rows
 * dismisses the previous popover automatically.
 *
 * Menu items per spec §"Group context menu":
 *   - Pin to top   (stub — v1.1 ships per-user ordering)
 *   - Rename       (flips the row into inline-edit mode)
 *   - Share        (stub — sharing UI not in v1)
 *   ────
 *   - Hide from sidebar  (per-user hide via useHide*)
 *   - Archive plan       (plans only — flips status to 'archived')
 *   - Delete list        (lists only, danger color)
 */
import { useEffect, useRef } from "react";
import {
  useHideList,
  useHidePlan,
  useDeleteList,
  useUpdateList,
} from "../lib/queries";
import { useUpdateTerritoryPlan } from "@/features/plans/lib/queries";
import { useViewsStore } from "../lib/store";
import type { GroupKind } from "../hooks/useViewsRouter";

interface GroupContextMenuProps {
  kind: GroupKind;
  id: string;
  /** Current label; passed through to the rename flow. */
  label: string;
  /** Tells the row to drop into inline-edit mode. */
  onStartRename: () => void;
}

export default function GroupContextMenu({
  kind,
  id,
  onStartRename,
}: GroupContextMenuProps) {
  const setMenuGroupId = useViewsStore((s) => s.setMenuGroupId);

  const hidePlan = useHidePlan();
  const hideList = useHideList();
  const deleteList = useDeleteList();
  const updatePlan = useUpdateTerritoryPlan();

  // updateList is unused in F2 but pre-imported to keep the wiring obvious
  // for the inline-rename callback in GroupRow. Suppressed unused with `_`.
  void useUpdateList;

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape. Mount-time listeners are sufficient
  // because the menu only renders when open.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuGroupId(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuGroupId(null);
    }
    // Defer attaching until next tick so the click that *opened* the menu
    // doesn't immediately re-close it.
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [setMenuGroupId]);

  const close = () => setMenuGroupId(null);

  const isPlan = kind === "plan";

  const handlePin = () => {
    // TODO(saved-views v1.1): wire per-user pinning + reordering.
    console.warn(
      "[saved-views] Pin-to-top is not wired yet (TODO v1.1). Closing menu.",
    );
    close();
  };

  const handleRename = () => {
    onStartRename();
    close();
  };

  const handleShare = () => {
    // TODO(saved-views v1.1): share modal; v1 only honors the boolean flag.
    console.warn(
      "[saved-views] Share UI not in v1 (TODO v1.1). Closing menu.",
    );
    close();
  };

  const handleHide = () => {
    if (isPlan) {
      hidePlan.mutate({ id });
    } else {
      hideList.mutate({ id });
    }
    close();
  };

  const handleArchive = () => {
    if (!isPlan) return;
    updatePlan.mutate({ id, status: "archived" });
    close();
  };

  const handleDelete = () => {
    if (isPlan) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Delete this list? It will be removed for you and anyone it was shared with. This can't be undone.",
      );
      if (!ok) return;
    }
    deleteList.mutate(id);
    close();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      // Position below the ⋯ trigger, right-aligned. `top-full` puts the top
      // edge flush with the trigger's bottom; 2px gap matches the prototype.
      className="absolute right-1 top-full z-50 mt-0.5 min-w-[200px] rounded-xl border border-[#D4CFE2] bg-white p-1"
      style={{ boxShadow: "0 4px 12px rgba(64,55,112,0.12)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem label="Pin to top" onClick={handlePin} />
      <MenuItem label="Rename" onClick={handleRename} />
      <MenuItem label="Share" onClick={handleShare} />
      <div className="my-1 h-px bg-[#EFEDF5]" aria-hidden />
      <MenuItem
        label="Hide from sidebar"
        hint="Only affects you"
        onClick={handleHide}
      />
      {isPlan && (
        <MenuItem
          label="Archive plan"
          hint="Keeps history; removes from sidebar"
          onClick={handleArchive}
        />
      )}
      {!isPlan && (
        <MenuItem label="Delete list" danger onClick={handleDelete} />
      )}
    </div>
  );
}

interface MenuItemProps {
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}
function MenuItem({ label, hint, danger, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-[#F7F5FA] transition-colors duration-75 ${
        danger ? "text-[#c25a52]" : "text-[#403770]"
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
      {hint && (
        <span className="text-[10px] font-normal text-[#8A80A8] whitespace-nowrap">
          {hint}
        </span>
      )}
    </button>
  );
}
