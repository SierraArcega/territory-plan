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
  });
}

export function viewLayoutsSchema() {
  return z
    .object({
      table:     gridLayoutSchema("districts").optional(),
      contacts:  gridLayoutSchema("contacts").optional(),
      opps:      gridLayoutSchema("opps").optional(),
      vacancies: gridLayoutSchema("vacancies").optional(),
      news:      gridLayoutSchema("news").optional(),
      rfps:      gridLayoutSchema("rfps").optional(),
    })
    .nullable();
}

export type GridViewLayout = z.infer<ReturnType<typeof gridLayoutSchema>>;
export type ViewLayouts = z.infer<ReturnType<typeof viewLayoutsSchema>>;
