/**
 * View-type registry for the Saved Views feature.
 *
 * Each Plan/List in the My Views sidebar can be rendered through one of 6
 * "views" (Map / Table / Kanban / Contacts / Opps / Signals). Signals merges
 * the former Vacancies / News / RFPs tabs into one district-grouped feed.
 * The set is closed in v1 — adding a new view type means adding an entry here
 * AND a body component under `components/views/`.
 *
 * The icon for each view is a Lucide component reference; consumers render it
 * with `currentColor` per the Fullmind brand convention so coral/plum tinting
 * works via parent text color.
 */
import {
  Map as MapIcon,
  Table as TableIcon,
  Trello as KanbanIcon,
  Users as ContactsIcon,
  Briefcase as OppsIcon,
  RadioTower as SignalsIcon,
  type LucideIcon,
} from "lucide-react";

/** Discriminated identifier for one of the 6 view types. */
export type ViewId =
  | "map"
  | "table"
  | "kanban"
  | "contacts"
  | "opps"
  | "signals";

/** A view's rendering metadata — label + icon. */
export interface ViewSpec {
  id: ViewId;
  label: string;
  icon: LucideIcon;
}

/** Frozen registry — order here drives the order in the view-tabs strip. */
export const VIEW_SPECS: readonly ViewSpec[] = [
  { id: "map", label: "Map", icon: MapIcon },
  { id: "table", label: "Table", icon: TableIcon },
  { id: "kanban", label: "Kanban", icon: KanbanIcon },
  { id: "contacts", label: "Contacts", icon: ContactsIcon },
  { id: "opps", label: "Opps", icon: OppsIcon },
  { id: "signals", label: "Signals", icon: SignalsIcon },
] as const;

/** All valid view IDs, useful for URL validation. */
export const VIEW_IDS: readonly ViewId[] = VIEW_SPECS.map((v) => v.id);

/** Map view -> icon component for quick lookup in row renderers. */
export const VIEW_ICON: Record<ViewId, LucideIcon> = VIEW_SPECS.reduce(
  (acc, v) => {
    acc[v.id] = v.icon;
    return acc;
  },
  {} as Record<ViewId, LucideIcon>,
);

/** Default view when none specified in URL — first in the registry. */
export const DEFAULT_VIEW_ID: ViewId = "map";

export function isViewId(value: string): value is ViewId {
  return (VIEW_IDS as readonly string[]).includes(value);
}

export function lookupViewSpec(id: ViewId): ViewSpec {
  // Safe to non-null because id is constrained to the closed union; the
  // registry is built from the same union.
  const found = VIEW_SPECS.find((v) => v.id === id);
  if (!found) {
    throw new Error(`Unknown view id: ${id}`);
  }
  return found;
}
