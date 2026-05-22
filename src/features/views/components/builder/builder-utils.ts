/**
 * Shared helpers for the ListBuilder modal.
 *
 * Default-rule construction, source counts (placeholder for now — TODO swap
 * to a real `/api/lists/source-totals` endpoint when shipped), and a few
 * pure formatting helpers extracted to keep the components small.
 */
import type {
  FilterLeaf,
  FilterRule,
  FilterAny,
  FilterNode,
  FilterAnd,
  SavedListSource,
  ScopeMode,
} from "@/lib/saved-views/filter-tree";
import {
  SOURCE_FIELDS,
  type FieldDef,
  type FieldOp,
} from "@/lib/saved-views/source-fields";

/** Friendly source meta — emoji icon + total-count placeholder for the picker. */
export interface SourceMeta {
  id: SavedListSource;
  label: string;
  icon: string;
  /** Placeholder total — TODO replace with live count once API exists. */
  countBase: number;
}

export const SOURCE_META: readonly SourceMeta[] = [
  { id: "districts", label: "Districts", icon: "🗺️", countBase: 12847 },
  { id: "contacts", label: "Contacts", icon: "👥", countBase: 4392 },
  { id: "opps", label: "Opps", icon: "💼", countBase: 218 },
  { id: "vacancies", label: "Vacancies", icon: "👤", countBase: 982 },
  { id: "news", label: "News", icon: "📰", countBase: 6140 },
  { id: "rfps", label: "RFPs", icon: "📄", countBase: 318 },
] as const;

/** Default UI placeholder when a `value` slot has no enum to choose from. */
const TYPE_DEFAULT_VALUE: Record<FieldDef["type"], string | number | boolean> = {
  text: "",
  enum: "",
  integer: 0,
  decimal: 0,
  boolean: true,
  date: "",
  duration: "30 days",
};

/** Build the first valid rule for a source — used when adding a new condition. */
export function defaultRule(source: SavedListSource): FilterRule {
  const fields = SOURCE_FIELDS[source];
  const field = fields[0];
  const op = field.ops[0];
  const value =
    field.enumValues && field.enumValues.length > 0
      ? field.enumValues[0]
      : TYPE_DEFAULT_VALUE[field.type];
  return {
    kind: "rule",
    fieldId: field.id,
    op,
    value: value as FilterRule["value"],
  };
}

/** Build a fresh districts rule — used by the scope=rules editor. */
export function defaultDistrictsRule(): FilterRule {
  return defaultRule("districts");
}

/** Map operator string to an `op` that the SQL compiler accepts. */
export function isAnyOp(op: string): boolean {
  return op === "is any of" || op === "is not any of";
}

/**
 * When the field is switched in a row, snap the op + value to something valid
 * for the new field's allowlist. Drops the existing `value`/`values` payload.
 */
export function replaceRowField(
  source: SavedListSource,
  fieldId: string,
): FilterRule | FilterAny {
  const fields = SOURCE_FIELDS[source];
  const field = fields.find((f) => f.id === fieldId) ?? fields[0];
  const op = field.ops[0];
  // Default to a rule (single-value); the user can switch to an "is any of"
  // op manually to convert to a multi-value chip.
  if (isAnyOp(op)) {
    return {
      kind: "any",
      fieldId: field.id,
      op,
      values: field.enumValues && field.enumValues.length > 0
        ? [field.enumValues[0]]
        : [],
    };
  }
  const value =
    field.enumValues && field.enumValues.length > 0
      ? field.enumValues[0]
      : TYPE_DEFAULT_VALUE[field.type];
  return {
    kind: "rule",
    fieldId: field.id,
    op,
    value: value as FilterRule["value"],
  };
}

/**
 * Adjusting the operator may flip rule kind:
 *   `is any of` / `is not any of`  → kind: "any"
 *   anything else                  → kind: "rule"
 */
export function changeRowOp(
  row: FilterRule | FilterAny,
  newOp: string,
  field: FieldDef,
): FilterRule | FilterAny {
  if (isAnyOp(newOp)) {
    if (row.kind === "any") {
      return { ...row, op: newOp };
    }
    const valueAsValid = row.value;
    return {
      kind: "any",
      fieldId: row.fieldId,
      op: newOp,
      values:
        valueAsValid != null && valueAsValid !== ""
          ? [valueAsValid]
          : field.enumValues && field.enumValues.length > 0
            ? [field.enumValues[0]]
            : [],
    };
  }
  if (row.kind === "rule") {
    return { ...row, op: newOp };
  }
  // collapsing "any" to single — pick the first value
  return {
    kind: "rule",
    fieldId: row.fieldId,
    op: newOp,
    value: (row.values[0] ?? null) as FilterRule["value"],
  };
}

/** Wrap a flat rules list back into an AND tree for persistence. */
export function rulesToTree(rules: readonly FilterLeaf[]): FilterAnd {
  return { kind: "and", children: rules.map((r) => ({ ...r })) };
}

/** Drop any rules that target fields not in the new source's allowlist. */
export function pruneRulesForSource(
  rules: readonly FilterLeaf[],
  source: SavedListSource,
): FilterLeaf[] {
  const fieldIds = new Set(SOURCE_FIELDS[source].map((f) => f.id));
  return rules.filter((r) => fieldIds.has(r.fieldId));
}

/** True when the row is in `is any of` mode and renders chip-pills. */
export function isAnyRow(row: FilterLeaf): row is FilterAny {
  return row.kind === "any";
}

/** Default view-id per source — used after a successful Create to navigate. */
export const SOURCE_DEFAULT_VIEW: Record<SavedListSource, string> = {
  districts: "table",
  contacts: "contacts",
  opps: "opps",
  vacancies: "vacancies",
  news: "news",
  rfps: "rfps",
};

/** Per-source name placeholder when the rep hasn't typed anything yet. */
export const NAME_PLACEHOLDER: Record<SavedListSource, string> = {
  districts: "e.g. Tier A · NY/NJ prospects",
  contacts: "e.g. Champions in Northeast",
  opps: "e.g. Q3 close pipeline",
  vacancies: "e.g. Leadership vacancies · my plans",
  news: "e.g. Funding news · target districts",
  rfps: "e.g. Curriculum RFPs > $100K",
};

/** True when the (source, fieldId) is valid in the allowlist. */
export function isValidField(
  source: SavedListSource,
  fieldId: string,
): boolean {
  return SOURCE_FIELDS[source].some((f) => f.id === fieldId);
}

/** Predicate helper used by tests + the modal footer count line. */
export function totalLeafCount(
  rules: readonly FilterLeaf[],
  scopeMode: ScopeMode,
  scopeRules: readonly FilterLeaf[],
): number {
  const scopeCount =
    scopeMode === "rules"
      ? scopeRules.length
      : scopeMode === "reference"
        ? 1
        : 0;
  return rules.length + scopeCount;
}

/** Re-export the op shorthand so tests can pin behavior. */
export type { FieldDef, FieldOp, FilterNode };
