// Shared filter types and builder used by explore + batch endpoints

export type FilterOp =
  | "eq"
  | "neq"
  | "in"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is_true"
  | "is_false"
  | "is_empty"
  | "is_not_empty";

export interface FilterDef {
  column: string;
  op: FilterOp;
  value?: unknown;
}

// External column key → Prisma field name (also serves as allow-list)
export const DISTRICT_FIELD_MAP: Record<string, string> = {
  leaid: "leaid",
  name: "name",
  state: "stateAbbrev",
  enrollment: "enrollment",
  isCustomer: "isCustomer",
  hasOpenPipeline: "hasOpenPipeline",
  fy26_open_pipeline_value: "fy26OpenPipeline",
  fy26_closed_won_net_booking: "fy26ClosedWonNetBooking",
  salesExecutive: "salesExecutive",
  urbanicity: "urbanCentricLocale",
  graduationRate: "graduationRateTotal",
  mathProficiency: "mathProficiencyPct",
  readProficiency: "readProficiencyPct",
  sped_percent: "swdPct",
  ell_percent: "ellPct",
  free_lunch_percent: "childrenPovertyPercent",
  accountType: "accountType",
  notes: "notes",
  owner: "owner",
};

export function buildWhereClause(
  filters: FilterDef[],
  fieldMap?: Record<string, string>
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const f of filters) {
    const prismaField = fieldMap ? fieldMap[f.column] : f.column;
    if (!prismaField) continue; // skip unknown columns

    switch (f.op) {
      case "eq":
        where[prismaField] = f.value;
        break;
      case "neq":
        where[prismaField] = { not: f.value };
        break;
      case "in":
        where[prismaField] = { in: f.value };
        break;
      case "contains":
        where[prismaField] = {
          contains: f.value as string,
          mode: "insensitive",
        };
        break;
      case "gt":
        where[prismaField] = { gt: f.value };
        break;
      case "gte":
        where[prismaField] = { gte: f.value };
        break;
      case "lt":
        where[prismaField] = { lt: f.value };
        break;
      case "lte":
        where[prismaField] = { lte: f.value };
        break;
      case "between": {
        const [min, max] = f.value as [unknown, unknown];
        where[prismaField] = { gte: min, lte: max };
        break;
      }
      case "is_true":
        where[prismaField] = true;
        break;
      case "is_false":
        where[prismaField] = false;
        break;
      case "is_empty":
        where[prismaField] = null;
        break;
      case "is_not_empty":
        where[prismaField] = { not: null };
        break;
    }
  }

  return where;
}
