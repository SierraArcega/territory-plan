/**
 * Filter-tree types for Saved Views.
 *
 * A SavedList stores a recursive filter tree that, at preview/fetch time, is
 * compiled to read-only SQL against one of six entity sources. The tree shape
 * is intentionally narrow:
 *
 *   - `kind: 'rule'`     — single `field op value` predicate.
 *   - `kind: 'any'`      — collapsed OR-of-same-field expressed as
 *                          `field op IN (values…)`. UI-level only; the
 *                          flattener produces these from OR nodes that share
 *                          the same fieldId + op.
 *   - `kind: 'and'`      — AND-join of children; nested ANDs are unwrapped.
 *
 * Persistence note: this shape is locked at schemaVersion 1. Any change to
 * the shape requires a migration of existing JSON blobs in saved_lists.
 *
 * Frontend imports the same module — keep this file framework-free.
 */

export const FILTER_TREE_SCHEMA_VERSION = 1 as const;

export type FilterValue = string | number | boolean | null;

export interface FilterRule {
  kind: "rule";
  fieldId: string;
  op: string;
  value: FilterValue;
}

export interface FilterAny {
  kind: "any";
  fieldId: string;
  op: string;
  values: FilterValue[];
}

export interface FilterAnd {
  kind: "and";
  children: FilterNode[];
}

export type FilterLeaf = FilterRule | FilterAny;
export type FilterNode = FilterAnd | FilterRule | FilterAny;

/** SavedList source kind — the six entity sources the list builder supports. */
export type SavedListSource =
  | "districts"
  | "contacts"
  | "opps"
  | "vacancies"
  | "news"
  | "rfps";

export const SAVED_LIST_SOURCES: readonly SavedListSource[] = [
  "districts",
  "contacts",
  "opps",
  "vacancies",
  "news",
  "rfps",
] as const;

/** Scope mode — how the candidate set is seeded before applying filterTree. */
export type ScopeMode = "none" | "rules" | "reference";

/** Reference kind when scopeMode = "reference". */
export type ScopeRefKind = "plan" | "list";

export interface ListSpec {
  schemaVersion: typeof FILTER_TREE_SCHEMA_VERSION;
  source: SavedListSource;
  filterTree: FilterNode;
  scope:
    | { mode: "none" }
    | { mode: "rules"; filterTree: FilterNode }
    | { mode: "reference"; kind: ScopeRefKind; id: string };
}

/**
 * Result of flattening a FilterNode into the UI's flat AND-of-rules view.
 *
 * Warnings list cases the flattener couldn't collapse losslessly — typically
 * an OR over different fields, which doesn't have a flat `any` representation.
 * The list builder surfaces warnings as an amber notice so the rep knows the
 * tree was simplified.
 */
export interface FlattenResult {
  rules: FilterLeaf[];
  warnings: string[];
}

/**
 * Flatten a FilterNode for the manual condition editor.
 *
 * Rules:
 *   - AND nodes are unwrapped recursively.
 *   - A rule stays a rule.
 *   - An `any` stays an `any`.
 *
 * This implementation does NOT accept raw OR nodes — the persistence shape
 * has already collapsed them via the AI list builder's `emit_list_spec`
 * post-processor or the manual editor's add-condition path. If a caller ever
 * needs to flatten an OR node here (e.g. for a future migration), it should
 * be added explicitly with its own warning case.
 */
export function flattenForUi(node: FilterNode): FlattenResult {
  const rules: FilterLeaf[] = [];
  const warnings: string[] = [];

  const visit = (n: FilterNode): void => {
    if (n.kind === "and") {
      for (const child of n.children) {
        visit(child);
      }
      return;
    }
    if (n.kind === "rule" || n.kind === "any") {
      rules.push(n);
      return;
    }
    // Exhaustiveness guard — any future kind that lands in the schema
    // without an explicit case here surfaces as a warning instead of being
    // silently dropped.
    const exhaustive: never = n;
    warnings.push(`Unknown filter node kind: ${JSON.stringify(exhaustive)}`);
  };

  visit(node);
  return { rules, warnings };
}

/**
 * Create an empty AND filter tree — used by the manual editor when the user
 * has not yet added any conditions, and by the AI list builder when the model
 * emits an unconstrained spec.
 */
export function emptyAndTree(): FilterAnd {
  return { kind: "and", children: [] };
}

/**
 * Detect whether a tree is logically empty (no rules, no any nodes, no
 * non-empty nested ANDs). Used by the preview endpoint to short-circuit a
 * candidate-set-only query when no predicates apply.
 */
export function isEmptyTree(node: FilterNode): boolean {
  if (node.kind === "rule" || node.kind === "any") return false;
  return node.children.every((c) => isEmptyTree(c));
}
