import type { PrismaClient } from "@prisma/client";

/** Canonical open/closed test for opportunity stages. */
export const CLOSED_RX = /closed[_ ](won|lost)/i;

/** A deal is "open" when its stage is set and not Closed Won/Lost. */
export function isOpenDeal(stage: string | null | undefined): boolean {
  return !!stage && !CLOSED_RX.test(stage);
}

/** A deal is "overdue/slipping" when open and its close date has passed. */
export function isOverdue(closeDate: Date | null | undefined, now: Date): boolean {
  return closeDate != null && closeDate.getTime() < now.getTime();
}

export interface OpenDeal {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
  closeDate: string | null;
  districtLeaid: string | null;
  districtName: string | null;
  salesRepId: string | null;
  daysToClose: number | null;
  detailsLink: string | null;
}

type Db = Pick<PrismaClient, "opportunity">;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Open deals for a rep (or all), earliest close-date first. Mirrors /api/deals/open. */
export async function getOpenDeals(
  db: Db,
  opts: { ownerId: string | "all"; stateAbbrevs?: string[]; limit?: number; now?: Date },
): Promise<OpenDeal[]> {
  const limit = Math.min(opts.limit ?? 200, 1000);
  const now = (opts.now ?? new Date()).getTime();
  const ownerWhere = opts.ownerId === "all" ? {} : { salesRepId: opts.ownerId };
  const stateAbbrevs = opts.stateAbbrevs ?? [];

  const opps = await db.opportunity.findMany({
    where: {
      ...ownerWhere,
      stage: { not: null },
      ...(stateAbbrevs.length > 0
        ? { district: { is: { stateAbbrev: { in: stateAbbrevs } } } }
        : {}),
    },
    select: {
      id: true, name: true, stage: true, netBookingAmount: true, closeDate: true,
      districtLeaId: true, districtName: true, salesRepId: true, detailsLink: true,
    },
    orderBy: [{ closeDate: { sort: "asc", nulls: "last" } }],
    take: limit * 2,
  });

  return opps
    .filter((o) => isOpenDeal(o.stage))
    .slice(0, limit)
    .map((o) => ({
      id: o.id,
      name: o.name,
      stage: o.stage,
      amount: o.netBookingAmount ? Number(o.netBookingAmount) : null,
      closeDate: o.closeDate?.toISOString() ?? null,
      districtLeaid: o.districtLeaId,
      districtName: o.districtName,
      salesRepId: o.salesRepId,
      daysToClose:
        o.closeDate != null ? Math.round((o.closeDate.getTime() - now) / ONE_DAY_MS) : null,
      detailsLink: o.detailsLink,
    }));
}
