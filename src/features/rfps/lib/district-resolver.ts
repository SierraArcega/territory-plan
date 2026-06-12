import prisma from "@/lib/prisma";
import { abbrevToFips } from "@/lib/states";
import { matchByName } from "@/features/shared/lib/district-name-match";

export type ResolveResultKind =
  | "override_district"
  | "override_state"
  | "override_non_lea"
  | "name_match"
  | "unresolved";

export interface ResolveResult {
  leaid: string | null;
  kind: ResolveResultKind;
}

export interface ResolveAgencyArgs {
  agencyKey: number;
  agencyName: string;
  stateAbbrev: string | null;
}

export async function resolveAgency({
  agencyKey,
  agencyName,
  stateAbbrev,
}: ResolveAgencyArgs): Promise<ResolveResult> {
  // 1. Check manual override first.
  const override = await prisma.agencyDistrictMap.findUnique({ where: { agencyKey } });
  if (override) {
    if (override.kind === "district") {
      return { leaid: override.leaid, kind: "override_district" };
    }
    if (override.kind === "state") {
      return { leaid: null, kind: "override_state" };
    }
    if (override.kind === "non_lea") {
      return { leaid: null, kind: "override_non_lea" };
    }
  }

  // 2. Fall through to the shared tiered name match (exact → normalized →
  //    Dice fuzzy). Ambiguous and no-hit both stay unresolved here.
  const fips = abbrevToFips(stateAbbrev);
  if (!fips) return { leaid: null, kind: "unresolved" };

  const districts = await prisma.district.findMany({
    where: { stateFips: fips },
    select: { leaid: true, name: true },
  });
  if (districts.length === 0) return { leaid: null, kind: "unresolved" };

  const match = matchByName(agencyName, districts);
  return match.kind === "match"
    ? { leaid: match.candidate.leaid, kind: "name_match" }
    : { leaid: null, kind: "unresolved" };
}
