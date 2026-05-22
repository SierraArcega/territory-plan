/**
 * Zod validators for SavedList filter trees and API payloads.
 *
 * Shared by API routes and the frontend list builder so payload shapes match
 * on both sides. The runtime shape is locked at FILTER_TREE_SCHEMA_VERSION.
 *
 * Field/op allowlists are enforced separately in source-fields.ts — Zod here
 * validates structure only.
 */
import { z } from "zod";
import {
  FILTER_TREE_SCHEMA_VERSION,
  SAVED_LIST_SOURCES,
  type FilterAnd,
  type FilterAny,
  type FilterNode,
  type FilterRule,
} from "./filter-tree";

const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const filterRuleSchema: z.ZodType<FilterRule> = z.object({
  kind: z.literal("rule"),
  fieldId: z.string().min(1).max(100),
  op: z.string().min(1).max(40),
  value: filterValueSchema,
});

export const filterAnySchema: z.ZodType<FilterAny> = z.object({
  kind: z.literal("any"),
  fieldId: z.string().min(1).max(100),
  op: z.string().min(1).max(40),
  values: z.array(filterValueSchema).max(500),
});

/**
 * Recursive AND-node schema. Children may themselves be AND nodes for nesting,
 * though the flattener collapses them at UI time.
 *
 * `z.lazy` is required for the recursive type — Zod can't infer recursion.
 */
export const filterNodeSchema: z.ZodType<FilterNode> = z.lazy(() =>
  z.union([
    filterAndSchema,
    filterRuleSchema,
    filterAnySchema,
  ]),
);

export const filterAndSchema: z.ZodType<FilterAnd> = z.object({
  kind: z.literal("and"),
  children: z.array(filterNodeSchema).max(50),
});

// Use a literal-union via z.enum so the inferred type is the precise
// SavedListSource union, not `string`. Zod's overload picks up the readonly
// tuple shape when we cast through `as`.
const SAVED_LIST_SOURCES_TUPLE = SAVED_LIST_SOURCES as readonly [
  (typeof SAVED_LIST_SOURCES)[number],
  ...(typeof SAVED_LIST_SOURCES)[number][],
];
export const savedListSourceSchema = z.enum(SAVED_LIST_SOURCES_TUPLE);

/** Scope payload for both lists and previews. */
export const scopeSchema = z.union([
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("rules"), filterTree: filterNodeSchema }),
  z.object({
    mode: z.literal("reference"),
    kind: z.enum(["plan", "list"]),
    id: z.string().min(1).max(64),
  }),
]);

/** Full ListSpec — what the AI list builder emits and what /api/lists POSTs accept. */
export const listSpecSchema = z.object({
  schemaVersion: z.literal(FILTER_TREE_SCHEMA_VERSION),
  source: savedListSourceSchema,
  filterTree: filterNodeSchema,
  scope: scopeSchema,
});

/** Body shape accepted by POST /api/lists (adds owner-visible fields). */
export const createListBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  source: savedListSourceSchema,
  filterTree: filterNodeSchema,
  scopeMode: z.enum(["none", "rules", "reference"]).default("none"),
  scopeFilterTree: filterNodeSchema.optional().nullable(),
  scopeRefKind: z.enum(["plan", "list"]).optional().nullable(),
  scopeRefId: z.string().min(1).max(64).optional().nullable(),
  shared: z.boolean().optional().default(false),
});

/** Body shape accepted by PATCH /api/lists/[id]. All fields optional. */
export const updateListBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  filterTree: filterNodeSchema.optional(),
  scopeMode: z.enum(["none", "rules", "reference"]).optional(),
  scopeFilterTree: filterNodeSchema.optional().nullable(),
  scopeRefKind: z.enum(["plan", "list"]).optional().nullable(),
  scopeRefId: z.string().min(1).max(64).optional().nullable(),
  shared: z.boolean().optional(),
});

/** Body shape accepted by POST /api/lists/preview. */
export const previewBodySchema = z.object({
  source: savedListSourceSchema,
  filterTree: filterNodeSchema,
  scopeMode: z.enum(["none", "rules", "reference"]).default("none"),
  scopeFilterTree: filterNodeSchema.optional().nullable(),
  scopeRefKind: z.enum(["plan", "list"]).optional().nullable(),
  scopeRefId: z.string().min(1).max(64).optional().nullable(),
});

/** Body shape accepted by POST /api/lists/[id]/hide and /api/territory-plans/[id]/hide. */
export const hideBodySchema = z.object({
  hidden: z.boolean(),
});

export type CreateListBody = z.infer<typeof createListBodySchema>;
export type UpdateListBody = z.infer<typeof updateListBodySchema>;
export type PreviewBody = z.infer<typeof previewBodySchema>;
export type HideBody = z.infer<typeof hideBodySchema>;
