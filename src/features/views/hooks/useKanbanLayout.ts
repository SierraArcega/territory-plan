/**
 * useKanbanLayout — kanban filter/sort/rank state with debounced (500ms) PATCH
 * to the parent plan/list's viewLayouts.kanban slot. Mirrors useGridLayout but
 * for the kanban layout shape (filters + sort + rankBuckets + rankSort; no
 * columns). Caller feeds the full saved viewLayouts blob.
 */
import { useEffect, useRef, useState } from "react";
import {
  useUpdatePlanLayout,
  useUpdateListLayout,
} from "@/features/views/lib/queries";
import type {
  KanbanLayout,
  ViewLayouts,
} from "@/lib/saved-views/grid-layout-schema";

export const DEFAULT_KANBAN_LAYOUT: KanbanLayout = {
  filters: { kind: "and", children: [] },
  sort: [],
  rankBuckets: [],
  rankSort: null,
};

const DEBOUNCE_MS = 500;

export interface UseKanbanLayoutArgs {
  parentKind: "plan" | "list";
  parentId: string;
  savedLayouts: ViewLayouts;
}

export function useKanbanLayout({
  parentKind,
  parentId,
  savedLayouts,
}: UseKanbanLayoutArgs) {
  const planMutation = useUpdatePlanLayout(parentKind === "plan" ? parentId : "");
  const listMutation = useUpdateListLayout(parentKind === "list" ? parentId : "");

  const initial = savedLayouts?.kanban ?? DEFAULT_KANBAN_LAYOUT;
  const [layout, setLayoutState] = useState<KanbanLayout>(initial);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ViewLayouts>(savedLayouts);
  savedRef.current = savedLayouts;

  const kanbanJson = JSON.stringify(savedLayouts?.kanban);
  useEffect(() => {
    const fromServer = savedLayouts?.kanban;
    if (fromServer) setLayoutState(fromServer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanbanJson]);

  const setLayout = (next: KanbanLayout) => {
    setLayoutState(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const merged: ViewLayouts = { ...(savedRef.current ?? {}), kanban: next };
      if (parentKind === "plan") planMutation.mutate(merged);
      else listMutation.mutate(merged);
    }, DEBOUNCE_MS);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { layout, setLayout };
}
