/**
 * Source-field allowlist for the Saved Views list builder.
 *
 * Every field that can appear in a SavedList filterTree must be registered
 * here. The allowlist enforces three guarantees at the API boundary:
 *
 *   1. Field IDs come from a known set (else 400 — "Unknown field").
 *   2. Each field maps to a single DB column (escapes parameterization issues).
 *   3. Each (field, op) pair is in the allowed-ops set for that field.
 *
 * The mapping is intentionally small for v1 — it covers the fields surfaced
 * in the prototype's list-builder. The set will grow when the manual editor
 * adds new fields, but ALL additions must be made here.
 *
 * Operator semantics are translated by the preview-SQL compiler. The strings
 * here are the same `op` values the UI and AI builder emit, so editing them
 * has cross-cutting consequences — favor adding new ops over renaming.
 */
import type { SavedListSource } from "./filter-tree";

/** Field data type — drives both UI input widget and SQL value coercion. */
export type FieldType =
  | "text"
  | "enum"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "duration"; // relative-time, e.g. "within 30 days"

/** Operator vocabulary — small set covering the prototype's editor. */
export type FieldOp =
  | "is"
  | "is not"
  | "is any of"
  | "is not any of"
  | ">"
  | "<"
  | ">="
  | "<="
  | "within"
  | "before"
  | "contains"
  | "is empty"
  | "is not empty";

export interface FieldDef {
  /** Stable ID emitted by the UI + AI builder; persists in filter_tree JSON. */
  id: string;
  /** Rep-facing label shown in the editor. */
  label: string;
  /** Underlying DB column in the source's primary table. */
  column: string;
  type: FieldType;
  /** Allowed operators for this field. */
  ops: FieldOp[];
  /** Optional enum of allowed `value` strings — also used by the UI value picker. */
  enumValues?: readonly string[];
}

/**
 * The map below is the SOLE allowlist. The compiler will reject any rule whose
 * `fieldId` is not a key in `SOURCE_FIELDS[source]` or whose `op` is not in
 * `field.ops`.
 *
 * Column names map to real DB columns; the SQL builder uses these directly.
 * NEVER concatenate user-supplied values into SQL — only the column name is
 * trusted (it comes from this allowlist), the value is always a $1 parameter.
 */
export const SOURCE_FIELDS: Record<SavedListSource, FieldDef[]> = {
  districts: [
    {
      id: "state",
      label: "State",
      column: "state_abbrev",
      type: "enum",
      ops: ["is", "is not", "is any of", "is not any of"],
    },
    {
      id: "enrollment",
      label: "Enrollment",
      column: "enrollment",
      type: "integer",
      ops: [">", "<", ">=", "<="],
    },
    {
      id: "is_customer",
      label: "Is customer",
      column: "is_customer",
      type: "boolean",
      ops: ["is"],
    },
    {
      id: "has_open_pipeline",
      label: "Has open pipeline",
      column: "has_open_pipeline",
      type: "boolean",
      ops: ["is"],
    },
    {
      id: "frpl_rate",
      label: "FRPL rate",
      column: "frpl_rate",
      type: "decimal",
      ops: [">", "<", ">=", "<="],
    },
    {
      id: "name",
      label: "Name",
      column: "name",
      type: "text",
      ops: ["is", "contains"],
    },
  ],
  contacts: [
    {
      id: "title",
      label: "Title",
      column: "title",
      type: "text",
      ops: ["is", "contains"],
    },
    {
      id: "persona",
      label: "Persona",
      column: "persona",
      type: "text",
      ops: ["is", "is any of", "contains"],
    },
    {
      id: "seniority_level",
      label: "Seniority",
      column: "seniority_level",
      type: "text",
      ops: ["is", "is any of"],
    },
    {
      id: "is_primary",
      label: "Is primary",
      column: "is_primary",
      type: "boolean",
      ops: ["is"],
    },
    {
      id: "leaid",
      label: "District",
      column: "leaid",
      type: "text",
      ops: ["is", "is any of"],
    },
  ],
  opps: [
    {
      id: "stage",
      label: "Stage",
      column: "stage",
      type: "text",
      ops: ["is", "is not", "is any of", "is not any of"],
    },
    {
      id: "net_booking_amount",
      label: "Bookings",
      column: "net_booking_amount",
      type: "decimal",
      ops: [">", "<", ">=", "<="],
    },
    {
      id: "close_date",
      label: "Close date",
      column: "close_date",
      type: "date",
      ops: ["before", "within", ">=", "<="],
    },
    {
      id: "state",
      label: "State",
      column: "state",
      type: "text",
      ops: ["is", "is any of"],
    },
    {
      id: "school_yr",
      label: "School year",
      column: "school_yr",
      type: "text",
      ops: ["is", "is any of"],
    },
  ],
  vacancies: [
    {
      id: "status",
      label: "Status",
      column: "status",
      type: "enum",
      ops: ["is", "is not", "is any of"],
      enumValues: ["open", "closed", "expired"],
    },
    {
      id: "category",
      label: "Category",
      column: "category",
      type: "enum",
      ops: ["is", "is any of"],
      enumValues: [
        "SPED",
        "ELL",
        "General Ed",
        "Admin",
        "Specialist",
        "Counseling",
        "Related Services",
        "Other",
      ],
    },
    {
      id: "fullmind_relevant",
      label: "Fullmind relevant",
      column: "fullmind_relevant",
      type: "boolean",
      ops: ["is"],
    },
    {
      id: "title",
      label: "Title",
      column: "title",
      type: "text",
      ops: ["contains"],
    },
    {
      id: "date_posted",
      label: "Posted",
      column: "date_posted",
      type: "date",
      ops: ["within", "before", ">=", "<="],
    },
  ],
  news: [
    {
      id: "fullmind_relevance",
      label: "Relevance",
      column: "fullmind_relevance",
      type: "enum",
      ops: ["is", "is any of"],
      enumValues: ["high", "medium", "low"],
    },
    {
      id: "feed_source",
      label: "Source",
      column: "feed_source",
      type: "text",
      ops: ["is", "is any of"],
    },
    {
      id: "published_at",
      label: "Published",
      column: "published_at",
      type: "date",
      ops: ["within", "before", ">=", "<="],
    },
    {
      id: "title",
      label: "Title",
      column: "title",
      type: "text",
      ops: ["contains"],
    },
  ],
  rfps: [
    {
      id: "status",
      label: "Status",
      column: "status",
      type: "text",
      ops: ["is", "is not", "is any of"],
    },
    {
      id: "fullmind_relevance",
      label: "Relevance",
      column: "fullmind_relevance",
      type: "enum",
      ops: ["is", "is any of"],
      enumValues: ["high", "medium", "low"],
    },
    {
      id: "value_low",
      label: "Min value",
      column: "value_low",
      type: "decimal",
      ops: [">", "<", ">=", "<="],
    },
    {
      id: "value_high",
      label: "Max value",
      column: "value_high",
      type: "decimal",
      ops: [">", "<", ">=", "<="],
    },
    {
      id: "due_date",
      label: "Due",
      column: "due_date",
      type: "date",
      ops: ["before", "within", ">=", "<="],
    },
    {
      id: "state",
      label: "State",
      column: "state_abbrev",
      type: "text",
      ops: ["is", "is any of"],
    },
  ],
};

/**
 * Look up a field def, returning null when not in the allowlist. Callers
 * should treat null as a 400 ("Unknown field") response.
 */
export function lookupField(
  source: SavedListSource,
  fieldId: string,
): FieldDef | null {
  const fields = SOURCE_FIELDS[source];
  return fields.find((f) => f.id === fieldId) ?? null;
}

/**
 * Validate that the (source, fieldId, op) triple is allowed. Returns null on
 * success or a string error on failure.
 */
export function validateFieldOp(
  source: SavedListSource,
  fieldId: string,
  op: string,
): string | null {
  const field = lookupField(source, fieldId);
  if (!field) {
    return `Unknown field "${fieldId}" for source "${source}".`;
  }
  if (!(field.ops as readonly string[]).includes(op)) {
    return `Operator "${op}" not allowed for field "${fieldId}".`;
  }
  return null;
}

/**
 * Per-source physical table + the column that joins to a district. Used by
 * the preview SQL builder and by scope=reference compilation.
 */
export interface SourceTableInfo {
  /** Physical table name in Postgres. */
  table: string;
  /**
   * Column on `table` that joins to `districts.leaid` — used by scope=rules
   * and scope=reference (plan member districts) to scope the candidate set.
   * Null when the source has no per-district scope (none today; reserved).
   */
  districtJoinColumn: string | null;
  /** Primary-key column (for sample queries). */
  primaryKey: string;
}

export const SOURCE_TABLES: Record<SavedListSource, SourceTableInfo> = {
  districts: {
    table: "districts",
    districtJoinColumn: "leaid",
    primaryKey: "leaid",
  },
  contacts: {
    table: "contacts",
    districtJoinColumn: "leaid",
    primaryKey: "id",
  },
  opps: {
    table: "opportunities",
    districtJoinColumn: "district_lea_id",
    primaryKey: "id",
  },
  vacancies: {
    table: "vacancies",
    districtJoinColumn: "leaid",
    primaryKey: "id",
  },
  news: {
    table: "news_articles",
    // News joins through news_article_districts — see preview builder.
    districtJoinColumn: null,
    primaryKey: "id",
  },
  rfps: {
    table: "rfps",
    districtJoinColumn: "leaid",
    primaryKey: "id",
  },
};
