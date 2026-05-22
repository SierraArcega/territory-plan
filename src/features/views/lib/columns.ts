import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { EnumSourceId } from "./enum-sources";
import { NOTE_TYPE_VALUES, NOTE_TYPE_LABELS } from "./note-types";

export type FilterWidget =
  | { kind: "multiselect"; values: readonly string[]; labels?: Record<string, string> }
  | { kind: "multiselect"; enumSource: EnumSourceId }
  | { kind: "select"; values: readonly string[] }
  | { kind: "select"; enumSource: EnumSourceId }
  | { kind: "numberRange"; min?: number; max?: number; step?: number;
      presets?: readonly { label: string; range: readonly [number, number] }[] }
  | { kind: "dateRange";
      relativeChips?: readonly ("7d" | "30d" | "90d" | "qtd" | "ytd")[] }
  | { kind: "toggle"; labels: { on: string; off: string } }
  | { kind: "text" };

export interface ColumnDef {
  id: string;
  header: string;
  kind: "raw" | "derived";
  /** When kind:"raw" — read from SOURCE_FIELDS[source][filterFieldId].column.
   *  When kind:"derived" — a client-side fn name resolved in the grid renderer. */
  accessor: string;
  sortable: boolean;
  filterFieldId: string | null;
  filterWidget: FilterWidget | null;
  align: "left" | "right" | "center";
  format: "money" | "number" | "percent" | "date" | "pill" | "text" | "avatar" | "boolean";
  defaultVisible: boolean;
  defaultOrder: number;
  /**
   * Optional group label rendered as a spanning row above the column header.
   * Contiguous visible columns that share a group merge into one spanning
   * cell. Ungrouped columns leave the top-row cell blank.
   */
  group?: string;
}

const MONEY_PRESETS = [
  { label: "$0–$50k",      range: [0, 50_000]                         as readonly [number, number] },
  { label: "$50k–$250k",   range: [50_000, 250_000]                   as readonly [number, number] },
  { label: "$250k–$1M",    range: [250_000, 1_000_000]                as readonly [number, number] },
  { label: "$1M+",         range: [1_000_000, Number.MAX_SAFE_INTEGER] as readonly [number, number] },
] as const;

const RELATIVE_DATE_CHIPS = ["7d", "30d", "90d", "qtd", "ytd"] as const;

export const SOURCE_COLUMNS: Record<SavedListSource, ColumnDef[]> = {
  districts: [
    { id: "name",          header: "District",   kind: "raw",     accessor: "name",
      sortable: true,  filterFieldId: "name",            filterWidget: { kind: "text" },
      align: "left",   format: "text",   defaultVisible: true,  defaultOrder: 0 },
    // Global derived label: "#1", "#2", ..., "Win Back", or "New". Read-only.
    // Server emits a single string on the row; cell renderer styles by prefix.
    { id: "customer_rank", header: "Customer rank", kind: "derived", accessor: "customerRank",
      sortable: true,  filterFieldId: null,              filterWidget: null,
      align: "left",   format: "pill",   defaultVisible: true,  defaultOrder: 1 },
    // Per-plan churn risk pill. Inline-editable select (low/medium/high/churned).
    // Filter joins to territory_plan_districts; sort orders by severity.
    { id: "churn_risk", header: "Churn risk", kind: "derived", accessor: "churnRisk",
      sortable: true,  filterFieldId: "churn_risk",      filterWidget: { kind: "multiselect", values: ["low","medium","high","churned"] },
      align: "left",   format: "pill",   defaultVisible: true,  defaultOrder: 2 },
    // Per-plan free-form notes. Inline-editable contenteditable cell.
    { id: "plan_notes", header: "Notes", kind: "derived", accessor: "planNotes",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "left",   format: "text",   defaultVisible: true,  defaultOrder: 3 },
    { id: "state",         header: "State",      kind: "raw",     accessor: "stateAbbrev",
      sortable: true,  filterFieldId: "state",           filterWidget: { kind: "multiselect", enumSource: "states" },
      align: "left",   format: "text",   defaultVisible: true,  defaultOrder: 4 },
    // Plan-scoped: server enriches the row with `target` (sum of the four
    // plan-district target columns). Null outside a plan context.
    { id: "target",        header: "Target",     kind: "derived", accessor: "target",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "money",  defaultVisible: true,  defaultOrder: 5 },
    // Open deals (not Closed Won / Closed Lost) — count + min/max
    // net_booking_amount. Plan-scoped, school-year filtered.
    { id: "open_count",    header: "Count",      kind: "derived", accessor: "openCount",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "number", defaultVisible: true,  defaultOrder: 6, group: "Pipeline" },
    { id: "pipeline_min",  header: "Min",        kind: "derived", accessor: "pipelineMin",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "money",  defaultVisible: true,  defaultOrder: 7, group: "Pipeline" },
    { id: "pipeline_max",  header: "Max",        kind: "derived", accessor: "pipelineMax",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "money",  defaultVisible: true,  defaultOrder: 8, group: "Pipeline" },
    // Closed Won deals — count + min/max net_booking_amount.
    { id: "won_count",     header: "Count",      kind: "derived", accessor: "wonCount",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "number", defaultVisible: true,  defaultOrder: 9, group: "Closed Won" },
    { id: "won_min",       header: "Min",        kind: "derived", accessor: "wonMin",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "money",  defaultVisible: true,  defaultOrder: 10, group: "Closed Won" },
    { id: "won_max",       header: "Max",        kind: "derived", accessor: "wonMax",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "money",  defaultVisible: true,  defaultOrder: 11, group: "Closed Won" },
    // Closed Lost deals — count only.
    { id: "lost_count",    header: "Count",      kind: "derived", accessor: "lostCount",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "number", defaultVisible: true,  defaultOrder: 12, group: "Closed Lost" },
    // Last (most recent past) activity from activity_districts. Plan-scope
    // independent — uses all activities linked to the district.
    { id: "last_activity_date", header: "Date",  kind: "derived", accessor: "lastActivityDate",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "left",   format: "date",   defaultVisible: true,  defaultOrder: 13, group: "Last activity" },
    { id: "last_activity_name", header: "Name",  kind: "derived", accessor: "lastActivityName",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "left",   format: "text",   defaultVisible: true,  defaultOrder: 14, group: "Last activity" },
    // Next (next upcoming) activity.
    { id: "next_activity_date", header: "Date",  kind: "derived", accessor: "nextActivityDate",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "left",   format: "date",   defaultVisible: true,  defaultOrder: 15, group: "Next activity" },
    { id: "next_activity_name", header: "Name",  kind: "derived", accessor: "nextActivityName",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "left",   format: "text",   defaultVisible: true,  defaultOrder: 16, group: "Next activity" },
    // Count of activities started in the trailing 90 days.
    { id: "activities_count_90d", header: "Activities (90d)", kind: "derived", accessor: "activitiesCount90d",
      sortable: false, filterFieldId: null,              filterWidget: null,
      align: "right",  format: "number", defaultVisible: true,  defaultOrder: 17 },
    { id: "enrollment",    header: "Enrollment", kind: "raw",     accessor: "enrollment",
      sortable: true,  filterFieldId: "enrollment",      filterWidget: { kind: "numberRange", min: 0, step: 100 },
      align: "right",  format: "number", defaultVisible: false, defaultOrder: 18 },
    { id: "frpl_rate",     header: "FRPL %",     kind: "raw",     accessor: "frplRate",
      sortable: true,  filterFieldId: "frpl_rate",       filterWidget: { kind: "numberRange", min: 0, max: 1, step: 0.01 },
      align: "right",  format: "percent",defaultVisible: false, defaultOrder: 19 },
    { id: "is_customer",   header: "Customer",   kind: "raw",     accessor: "isCustomer",
      sortable: true,  filterFieldId: "is_customer",     filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean",defaultVisible: false, defaultOrder: 20 },
    { id: "has_open_pipe", header: "Open pipe",  kind: "raw",     accessor: "hasOpenPipeline",
      sortable: true,  filterFieldId: "has_open_pipeline", filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean",defaultVisible: false, defaultOrder: 21 },
    // Plan-scoped virtual field. Filter-only — target lives in the
    // plan-district join table, so there's no per-row value to render in the
    // grid. Compiles to an EXISTS subquery on the backend.
    { id: "has_target",    header: "Has target",kind: "derived", accessor: "hasTarget",
      sortable: false, filterFieldId: "has_target",      filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean",defaultVisible: false, defaultOrder: 22 },
    { id: "note_type", header: "Note type", kind: "derived", accessor: "notesLatestType",
      sortable: false, filterFieldId: "note_type",
      filterWidget: { kind: "multiselect", values: NOTE_TYPE_VALUES, labels: NOTE_TYPE_LABELS },
      align: "left",  format: "pill",  defaultVisible: false, defaultOrder: 23 },
  ],
  contacts: [
    { id: "name",      header: "Name",      kind: "raw", accessor: "name",
      sortable: true,  filterFieldId: "name",          filterWidget: { kind: "text" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 0 },
    { id: "title",     header: "Title",     kind: "raw", accessor: "title",
      sortable: true,  filterFieldId: "title",         filterWidget: { kind: "text" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 1 },
    { id: "persona",   header: "Persona",   kind: "raw", accessor: "persona",
      sortable: true,  filterFieldId: "persona",       filterWidget: { kind: "multiselect", enumSource: "personas" },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 2 },
    { id: "seniority", header: "Seniority", kind: "raw", accessor: "seniorityLevel",
      sortable: true,  filterFieldId: "seniority_level",filterWidget: { kind: "multiselect", enumSource: "seniorities" },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 3 },
    { id: "is_primary",header: "Primary",   kind: "raw", accessor: "isPrimary",
      sortable: true,  filterFieldId: "is_primary",    filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean", defaultVisible: false, defaultOrder: 4 },
    { id: "leaid",     header: "District",  kind: "raw", accessor: "leaid",
      sortable: true,  filterFieldId: "leaid",         filterWidget: null,
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 5 },
  ],
  opps: [
    { id: "stage",      header: "Stage",       kind: "raw", accessor: "stage",
      sortable: true,  filterFieldId: "stage",         filterWidget: { kind: "multiselect", enumSource: "stages" },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 0 },
    { id: "bookings",   header: "Bookings",    kind: "raw", accessor: "netBookingAmount",
      sortable: true,  filterFieldId: "net_booking_amount", filterWidget: { kind: "numberRange", min: 0, presets: MONEY_PRESETS },
      align: "right",  format: "money", defaultVisible: true,  defaultOrder: 1 },
    { id: "close_date", header: "Close",       kind: "raw", accessor: "closeDate",
      sortable: true,  filterFieldId: "close_date",    filterWidget: { kind: "dateRange", relativeChips: RELATIVE_DATE_CHIPS },
      align: "left",   format: "date",  defaultVisible: true,  defaultOrder: 2 },
    { id: "state",      header: "State",       kind: "raw", accessor: "state",
      sortable: true,  filterFieldId: "state",         filterWidget: { kind: "multiselect", enumSource: "states" },
      align: "left",   format: "text",  defaultVisible: false, defaultOrder: 3 },
    { id: "school_yr",  header: "School year", kind: "raw", accessor: "schoolYr",
      sortable: true,  filterFieldId: "school_yr",     filterWidget: { kind: "multiselect", values: ["2024-25","2025-26","2026-27"] },
      align: "left",   format: "text",  defaultVisible: false, defaultOrder: 4 },
    { id: "owner",      header: "Owner",       kind: "raw", accessor: "ownerName",
      sortable: false, filterFieldId: null,            filterWidget: { kind: "multiselect", enumSource: "users" },
      align: "left",   format: "avatar",defaultVisible: true,  defaultOrder: 5 },
  ],
  vacancies: [
    { id: "status",            header: "Status",     kind: "raw", accessor: "status",
      sortable: true,  filterFieldId: "status",     filterWidget: { kind: "multiselect", values: ["open","closed","expired"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 0 },
    { id: "category",          header: "Category",   kind: "raw", accessor: "category",
      sortable: true,  filterFieldId: "category",   filterWidget: { kind: "multiselect", values: ["SPED","ELL","General Ed","Admin","Specialist","Counseling","Related Services","Other"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 1 },
    { id: "fullmind_relevant", header: "Relevant",   kind: "raw", accessor: "fullmindRelevant",
      sortable: true,  filterFieldId: "fullmind_relevant", filterWidget: { kind: "toggle", labels: { on: "Yes", off: "No" } },
      align: "center", format: "boolean",defaultVisible: false, defaultOrder: 2 },
    { id: "title",             header: "Title",      kind: "raw", accessor: "title",
      sortable: true,  filterFieldId: "title",      filterWidget: { kind: "text" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 3 },
    { id: "date_posted",       header: "Posted",     kind: "raw", accessor: "datePosted",
      sortable: true,  filterFieldId: "date_posted",filterWidget: { kind: "dateRange", relativeChips: RELATIVE_DATE_CHIPS },
      align: "left",   format: "date",  defaultVisible: true,  defaultOrder: 4 },
  ],
  news: [
    { id: "relevance",     header: "Relevance",  kind: "raw", accessor: "fullmindRelevance",
      sortable: true,  filterFieldId: "fullmind_relevance", filterWidget: { kind: "multiselect", values: ["high","medium","low"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 0 },
    { id: "feed_source",   header: "Source",     kind: "raw", accessor: "feedSource",
      sortable: true,  filterFieldId: "feed_source", filterWidget: { kind: "multiselect", enumSource: "feed_sources" },
      align: "left",   format: "text",  defaultVisible: false, defaultOrder: 1 },
    { id: "published_at",  header: "Published",  kind: "raw", accessor: "publishedAt",
      sortable: true,  filterFieldId: "published_at",filterWidget: { kind: "dateRange", relativeChips: RELATIVE_DATE_CHIPS },
      align: "left",   format: "date",  defaultVisible: true,  defaultOrder: 2 },
    { id: "title",         header: "Title",      kind: "raw", accessor: "title",
      sortable: true,  filterFieldId: "title",  filterWidget: { kind: "text" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 3 },
  ],
  rfps: [
    { id: "status",        header: "Status",     kind: "raw", accessor: "status",
      sortable: true,  filterFieldId: "status",  filterWidget: { kind: "multiselect", values: ["draft","open","awarded","closed"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 0 },
    { id: "relevance",     header: "Relevance",  kind: "raw", accessor: "fullmindRelevance",
      sortable: true,  filterFieldId: "fullmind_relevance", filterWidget: { kind: "multiselect", values: ["high","medium","low"] },
      align: "left",   format: "pill",  defaultVisible: true,  defaultOrder: 1 },
    { id: "value_low",     header: "Min value",  kind: "raw", accessor: "valueLow",
      sortable: true,  filterFieldId: "value_low",filterWidget: { kind: "numberRange", min: 0, presets: MONEY_PRESETS },
      align: "right",  format: "money", defaultVisible: false, defaultOrder: 2 },
    { id: "value_high",    header: "Max value",  kind: "raw", accessor: "valueHigh",
      sortable: true,  filterFieldId: "value_high",filterWidget: { kind: "numberRange", min: 0, presets: MONEY_PRESETS },
      align: "right",  format: "money", defaultVisible: true,  defaultOrder: 3 },
    { id: "due_date",      header: "Due",        kind: "raw", accessor: "dueDate",
      sortable: true,  filterFieldId: "due_date",filterWidget: { kind: "dateRange", relativeChips: RELATIVE_DATE_CHIPS },
      align: "left",   format: "date",  defaultVisible: true,  defaultOrder: 4 },
    { id: "state",         header: "State",      kind: "raw", accessor: "stateAbbrev",
      sortable: true,  filterFieldId: "state",   filterWidget: { kind: "multiselect", enumSource: "states" },
      align: "left",   format: "text",  defaultVisible: true,  defaultOrder: 5 },
  ],
};

export function getDefaultLayoutColumns(source: SavedListSource) {
  return SOURCE_COLUMNS[source]
    .slice()
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((c) => ({ id: c.id, order: c.defaultOrder, visible: c.defaultVisible }));
}

export function lookupColumn(source: SavedListSource, id: string): ColumnDef | null {
  return SOURCE_COLUMNS[source].find((c) => c.id === id) ?? null;
}
