/**
 * useGridLayout — manages per-view column/sort/filter layout state with
 * debounced auto-save (500 ms) to the server.
 *
 * Design choice: the hook is "caller-feeds-saved-layouts". The parent component
 * reads `parent.viewLayouts` from its own data-fetch and passes the full blob in
 * as `savedLayouts`. This keeps the hook stateless w.r.t. data fetching and
 * avoids a second API call inside the hook.
 *
 * The hook:
 *   1. Seeds local state from `savedLayouts[viewType]`, falling back to the
 *      source's default column layout.
 *   2. Re-hydrates from the server blob whenever it changes (e.g. on first
 *      fetch landing after mount).
 *   3. On every `setLayout(next)` call, updates local state immediately
 *      (optimistic) and resets a 500ms debounce timer.
 *   4. When the timer fires, merges `next` into the full `savedLayouts` blob
 *      (preserving other view types) and calls the appropriate mutation.
 *   5. Cleans up the pending timer on unmount.
 */
import { useEffect, useRef, useState } from "react";
import { getDefaultLayoutColumns } from "@/features/views/lib/columns";
import {
  useUpdatePlanLayout,
  useUpdateListLayout,
} from "@/features/views/lib/queries";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type {
  GridViewLayout,
  ViewLayouts,
} from "@/lib/saved-views/grid-layout-schema";

/** The set of view-type keys that can appear in a ViewLayouts blob. */
export type ViewTypeKey = NonNullable<keyof NonNullable<ViewLayouts>>;

export interface UseGridLayoutArgs {
  /** Whether the parent record is a territory plan or a saved list. */
  parentKind: "plan" | "list";
  /** The id of the parent plan or list. */
  parentId: string;
  /** Which view slot in the viewLayouts blob this instance manages. */
  viewType: ViewTypeKey;
  /** The SavedListSource that drives column/field definitions. */
  source: SavedListSource;
  /**
   * The full `viewLayouts` blob from the parent record (null if not yet
   * persisted). The caller reads `parent.viewLayouts` and passes it here.
   */
  savedLayouts: ViewLayouts;
}

const DEBOUNCE_MS = 500;

function defaultLayout(source: SavedListSource): GridViewLayout {
  return {
    columns: getDefaultLayoutColumns(source),
    sort: [],
    filters: { kind: "and", children: [] },
  };
}

export function useGridLayout(args: UseGridLayoutArgs) {
  const { parentKind, parentId, viewType, source, savedLayouts } = args;

  // Instantiate both mutations unconditionally (Rules of Hooks). Only the
  // relevant one will be called at runtime.
  const planMutation = useUpdatePlanLayout(
    parentKind === "plan" ? parentId : "",
  );
  const listMutation = useUpdateListLayout(
    parentKind === "list" ? parentId : "",
  );

  const initialLayout: GridViewLayout =
    savedLayouts?.[viewType] ?? defaultLayout(source);

  const [layout, setLayoutState] = useState<GridViewLayout>(initialLayout);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref to the latest savedLayouts so the debounce closure captures
  // the most-recent value without causing re-renders.
  const savedLayoutsRef = useRef<ViewLayouts>(savedLayouts);
  savedLayoutsRef.current = savedLayouts;

  // Re-hydrate local state from the server blob when it arrives / changes.
  // JSON.stringify in the dep array gives us deep-equality comparison on a
  // primitive so we only trigger when the server data actually differs.
  const viewTypeLayoutJson = JSON.stringify(savedLayouts?.[viewType]);
  useEffect(() => {
    const fromServer = savedLayouts?.[viewType];
    if (fromServer) {
      setLayoutState(fromServer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTypeLayoutJson]);

  const setLayout = (next: GridViewLayout) => {
    // Optimistic local update — visible immediately.
    setLayoutState(next);

    // Reset debounce.
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      // Merge: preserve all other view-type slots, overwrite this one.
      const merged: ViewLayouts = {
        ...(savedLayoutsRef.current ?? {}),
        [viewType]: next,
      };

      if (parentKind === "plan") {
        planMutation.mutate(merged);
      } else {
        listMutation.mutate(merged);
      }
    }, DEBOUNCE_MS);
  };

  // Cancel any pending debounce on unmount to avoid state updates after
  // the component tree is gone and to prevent stale saves.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { layout, setLayout };
}
