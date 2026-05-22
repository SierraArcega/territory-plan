import { z } from "zod";
import type { SavedListSource } from "./filter-tree";
import { filterAndSchema } from "./schema";
import { SOURCE_FIELDS } from "./source-fields";
import { SOURCE_COLUMNS } from "@/features/views/lib/columns";

const columnEntrySchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  width: z.number().positive().optional(),
  visible: z.boolean(),
});

const sortEntrySchema = z.object({
  id: z.string(),
  dir: z.enum(["asc", "desc"]),
});

const groupByEntrySchema = z.object({
  id: z.string(),
});

export function gridLayoutSchema(source: SavedListSource) {
  const knownColumnIds = new Set(SOURCE_COLUMNS[source].map((c) => c.id));
  const sortableFieldIds = new Set(SOURCE_FIELDS[source].map((f) => f.id));

  return z.object({
    columns: z.array(columnEntrySchema).superRefine((cols, ctx) => {
      for (const col of cols) {
        if (!knownColumnIds.has(col.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown column "${col.id}" for source "${source}"`,
          });
        }
      }
    }),
    sort: z.array(sortEntrySchema).superRefine((entries, ctx) => {
      for (const e of entries) {
        if (!sortableFieldIds.has(e.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Sort field "${e.id}" is not sortable for source "${source}"`,
          });
        }
      }
    }),
    filters: filterAndSchema,
    groupBy: groupByEntrySchema
      .nullable()
      .optional()
      .superRefine((gb, ctx) => {
        if (gb && !sortableFieldIds.has(gb.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Group field "${gb.id}" is not sortable for source "${source}"`,
          });
        }
      }),
  });
}

// Bucket values match LabelKind from global-customer-labels.ts: a ranked
// customer ("rank"), a win-back, or new — so the kanban route can compare a
// district's label to the selected buckets directly.
const rankBucketSchema = z.enum(["rank", "win_back", "new"]);

export function kanbanLayoutSchema() {
  // Kanban sorts/filters use the opps source's SQL fields, minus stage
  // (it's the columns) and school_yr (fixed by the plan).
  const sortableFieldIds = new Set(
    SOURCE_FIELDS.opps
      .map((f) => f.id)
      .filter((id) => id !== "stage" && id !== "school_yr"),
  );
  return z.object({
    filters: filterAndSchema,
    sort: z.array(sortEntrySchema).superRefine((entries, ctx) => {
      for (const e of entries) {
        if (!sortableFieldIds.has(e.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Sort field "${e.id}" is not sortable for the kanban`,
          });
        }
      }
    }),
    rankBuckets: z.array(rankBucketSchema),
    rankSort: z.enum(["asc", "desc"]).nullable(),
  });
}

// News has an extra `mode` field on top of the standard grid layout fields.
const newsLayoutSchema = z.object({
  columns: gridLayoutSchema("news").shape.columns,
  sort:    gridLayoutSchema("news").shape.sort,
  filters: gridLayoutSchema("news").shape.filters,
  groupBy: gridLayoutSchema("news").shape.groupBy,
  mode:    z.enum(["cards", "table"]).optional(),
});

export function viewLayoutsSchema() {
  return z
    .object({
      table:     gridLayoutSchema("districts").optional(),
      contacts:  gridLayoutSchema("contacts").optional(),
      opps:      gridLayoutSchema("opps").optional(),
      vacancies: gridLayoutSchema("vacancies").optional(),
      news:      newsLayoutSchema.optional(),
      rfps:      gridLayoutSchema("rfps").optional(),
      kanban:    kanbanLayoutSchema().optional(),
    })
    .nullable();
}

export type GridViewLayout = z.infer<ReturnType<typeof gridLayoutSchema>>;
export type ViewLayouts = z.infer<ReturnType<typeof viewLayoutsSchema>>;
export type KanbanLayout = z.infer<ReturnType<typeof kanbanLayoutSchema>>;
