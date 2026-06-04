import { TABLE_REGISTRY } from "@/lib/district-column-metadata";

/** True for columns that are internal identifiers (leaid, *_id, uuid, or a
 *  registry column whose format is "id"). Hidden from rep-facing result tables. */
export function isIdColumn(columnName: string): boolean {
  for (const tbl of Object.values(TABLE_REGISTRY)) {
    const match = tbl.columns.find((c) => c.column === columnName);
    if (match && (match.format as string) === "id") return true;
  }
  return /^(id|leaid|.*_id|uuid)$/i.test(columnName);
}
