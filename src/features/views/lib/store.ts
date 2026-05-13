/**
 * Zustand store for the Saved Views sidebar UI state.
 *
 * Holds transient UI flags that don't belong in URL state (e.g. which groups
 * are expanded, density preference) or in TanStack Query (e.g. server data).
 *
 * Persistence: only `density` is persisted to localStorage. Everything else
 * resets on reload because it's either URL-driven (active group, active view)
 * or session-only (hover/menu/builder open state).
 *
 * Subscription discipline (per CLAUDE.md): consumers should select narrow
 * primitives, e.g. `useViewsStore(s => s.density)`. Never select the entire
 * state object — that triggers re-renders on any field change.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ListSpec } from "@/lib/saved-views/filter-tree";

/** Sidebar row density mode — affects vertical padding on nav items + group rows. */
export type Density = "compact" | "comfortable";

/** Seed object for the list-builder modal — pre-populates fields on open. */
export interface BuilderSeed {
  filters?: ListSpec;
  name?: string;
}

/** UI state slice — UI-only flags + per-session toggles. */
interface ViewsState {
  /** Map of group id ("plan:abc" or "list:xyz") -> expanded boolean. */
  expandedGroups: Record<string, boolean>;
  /** Currently hovered group/view id — drives ⋯ menu fade-in. */
  hoverId: string | null;
  /** Currently open ⋯ context menu's owning group id, or null. */
  menuGroupId: string | null;
  /** Whether the sidebar reveals per-user hidden plans/lists. */
  showHidden: boolean;
  /** Row density preference — persisted across reloads. */
  density: Density;
  /** Whether the list-builder modal is open. */
  builderOpen: boolean;
  /** Pre-fill payload for the builder when opened from a "Save as list" CTA. */
  builderSeed: BuilderSeed | null;
}

interface ViewsActions {
  toggleGroup: (id: string) => void;
  setGroupExpanded: (id: string, expanded: boolean) => void;
  collapseAll: () => void;
  setHoverId: (id: string | null) => void;
  setMenuGroupId: (id: string | null) => void;
  setShowHidden: (showHidden: boolean) => void;
  toggleShowHidden: () => void;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
  openBuilder: (seed?: BuilderSeed | null) => void;
  closeBuilder: () => void;
}

export type ViewsStore = ViewsState & ViewsActions;

const initialState: ViewsState = {
  expandedGroups: {},
  hoverId: null,
  menuGroupId: null,
  showHidden: false,
  density: "compact",
  builderOpen: false,
  builderSeed: null,
};

/**
 * Persist only the density preference. Other slices are session-scoped to
 * keep the persisted blob small and avoid stale UI state after reloads.
 *
 * Key is namespaced "saved-views-" to avoid collisions with the legacy map
 * store's "territory-plan-storage" key.
 */
export const useViewsStore = create<ViewsStore>()(
  persist(
    (set) => ({
      ...initialState,

      toggleGroup: (id) =>
        set((s) => ({
          expandedGroups: {
            ...s.expandedGroups,
            [id]: !s.expandedGroups[id],
          },
        })),

      setGroupExpanded: (id, expanded) =>
        set((s) => ({
          expandedGroups: { ...s.expandedGroups, [id]: expanded },
        })),

      collapseAll: () => set({ expandedGroups: {} }),

      setHoverId: (id) => set({ hoverId: id }),

      setMenuGroupId: (id) => set({ menuGroupId: id }),

      setShowHidden: (showHidden) => set({ showHidden }),

      toggleShowHidden: () =>
        set((s) => ({ showHidden: !s.showHidden })),

      setDensity: (density) => set({ density }),

      toggleDensity: () =>
        set((s) => ({
          density: s.density === "compact" ? "comfortable" : "compact",
        })),

      openBuilder: (seed = null) =>
        // Batched single set() per CLAUDE.md to avoid cascading re-renders.
        set({ builderOpen: true, builderSeed: seed }),

      closeBuilder: () => set({ builderOpen: false, builderSeed: null }),
    }),
    {
      name: "saved-views-storage",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // SSR guard — return a noop storage so persist middleware doesn't
          // attempt to read localStorage during static analysis.
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      // Only persist density. Everything else is per-session.
      partialize: (state) => ({ density: state.density }),
    },
  ),
);

/** Selector helpers — narrow primitives only, per CLAUDE.md guidance. */
export const selectDensity = (s: ViewsStore): Density => s.density;
export const selectShowHidden = (s: ViewsStore): boolean => s.showHidden;
export const selectBuilderOpen = (s: ViewsStore): boolean => s.builderOpen;
export const selectHoverId = (s: ViewsStore): string | null => s.hoverId;
export const selectMenuGroupId = (s: ViewsStore): string | null => s.menuGroupId;

/** Returns true when the given group id is currently expanded. */
export const selectIsGroupExpanded =
  (id: string) =>
  (s: ViewsStore): boolean =>
    Boolean(s.expandedGroups[id]);
