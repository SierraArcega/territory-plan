/**
 * Public surface for the Saved Views feature.
 *
 * Re-exports the types, hooks, and store consumers outside `features/views/`
 * may need (e.g. AppShell, legacy fallback wiring). Internal modules should
 * still import via deep paths to avoid circular imports in the worktree.
 */

export type {
  ViewId,
  ViewSpec,
  DetailKind,
} from "./lib/view-types";
export {
  VIEW_SPECS,
  VIEW_IDS,
  VIEW_ICON,
  DEFAULT_VIEW_ID,
  DETAIL_KINDS,
  isViewId,
  isDetailKind,
  lookupViewSpec,
} from "./lib/view-types";

export {
  useViewsStore,
  selectDensity,
  selectShowHidden,
  selectBuilderOpen,
  selectHoverId,
  selectMenuGroupId,
  selectIsGroupExpanded,
} from "./lib/store";
export type { Density, BuilderSeed, ViewsStore } from "./lib/store";
