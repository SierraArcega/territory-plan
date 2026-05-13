/**
 * View-type registry for the Saved Views feature.
 *
 * Each Plan/List in the My Views sidebar can be rendered through one of 8
 * "views" (Map / Table / Kanban / Contacts / Opps / Vacancies / News / RFPs).
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
  UserSearch as VacanciesIcon,
  Newspaper as NewsIcon,
  FileText as RfpsIcon,
  type LucideIcon,
} from "lucide-react";

/** Discriminated identifier for one of the 8 view types. */
export type ViewId =
  | "map"
  | "table"
  | "kanban"
  | "contacts"
  | "opps"
  | "vacancies"
  | "news"
  | "rfps";

/** Discriminated identifier for the entity kind a detail panel may show. */
export type DetailKind =
  | "district"
  | "contact"
  | "opp"
  | "vacancy"
  | "news"
  | "rfp";

/** A view's rendering metadata — label + icon + the detail kind row clicks open. */
export interface ViewSpec {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  /** Entity kind whose detail panel opens when a row in this view is clicked. */
  detailKind: DetailKind;
}

/** Frozen registry — order here drives the order in the view-tabs strip. */
export const VIEW_SPECS: readonly ViewSpec[] = [
  { id: "map", label: "Map", icon: MapIcon, detailKind: "district" },
  { id: "table", label: "Table", icon: TableIcon, detailKind: "district" },
  { id: "kanban", label: "Kanban", icon: KanbanIcon, detailKind: "district" },
  { id: "contacts", label: "Contacts", icon: ContactsIcon, detailKind: "contact" },
  { id: "opps", label: "Opps", icon: OppsIcon, detailKind: "opp" },
  { id: "vacancies", label: "Vacancies", icon: VacanciesIcon, detailKind: "vacancy" },
  { id: "news", label: "News", icon: NewsIcon, detailKind: "news" },
  { id: "rfps", label: "RFPs", icon: RfpsIcon, detailKind: "rfp" },
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

/** All valid detail kinds — used by URL parser when reading `?detail=kind:id`. */
export const DETAIL_KINDS: readonly DetailKind[] = [
  "district",
  "contact",
  "opp",
  "vacancy",
  "news",
  "rfp",
] as const;

export function isDetailKind(value: string): value is DetailKind {
  return (DETAIL_KINDS as readonly string[]).includes(value);
}
