import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/territory-plans/[id]/contact-sources
//
// Returns other territory plans that share at least one district leaid with the
// given plan AND already have at least one Contact row on at least one of those
// shared leaids. Used by the "Existing contacts" modal on Find Contacts to
// offer users a path to a plan that already surfaces the relevant contacts.
//
// Auth scope: team-wide (mirrors the plan-list + /contacts GET endpoints,
// which both comment "team shares visibility across plans").
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // 1. Load current plan + its district leaids
    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        districts: {
          select: { districtLeaid: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    const leaids = plan.districts.map((d) => d.districtLeaid);
    if (leaids.length === 0) {
      return NextResponse.json({ plans: [] });
    }

    // 2. Find candidate other plans sharing >=1 leaid with the current plan.
    //    Include only the shared districts so we can compute sharedDistrictCount
    //    locally without a second round-trip.
    const candidates = await prisma.territoryPlan.findMany({
      where: {
        id: { not: id },
        districts: { some: { districtLeaid: { in: leaids } } },
      },
      include: {
        districts: {
          where: { districtLeaid: { in: leaids } },
          select: { districtLeaid: true },
        },
        ownerUser: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (candidates.length === 0) {
      return NextResponse.json({ plans: [] });
    }

    // 3. Aggregate contact counts + last-enriched timestamps per leaid, scoped
    //    to the leaids we care about (the current plan's leaids). Contacts are
    //    leaid-keyed (not plan-keyed), so any plan containing that leaid sees
    //    the same contact set.
    const contactAgg = await prisma.contact.groupBy({
      by: ["leaid"],
      where: { leaid: { in: leaids } },
      _count: { _all: true },
      _max: { lastEnrichedAt: true },
    });

    const byLeaid = new Map<
      string,
      { count: number; lastEnriched: Date | null }
    >(
      contactAgg.map((a) => [
        a.leaid,
        { count: a._count._all, lastEnriched: a._max.lastEnrichedAt ?? null },
      ])
    );

    // 4. For each candidate, fold shared-leaid stats into the plan row.
    const enriched = candidates.map((c) => {
      const sharedLeaids = c.districts.map((d) => d.districtLeaid);
      let contactCount = 0;
      let lastEnrichedAt: Date | null = null;
      for (const leaid of sharedLeaids) {
        const agg = byLeaid.get(leaid);
        if (!agg) continue;
        contactCount += agg.count;
        if (
          agg.lastEnriched &&
          (!lastEnrichedAt || agg.lastEnriched > lastEnrichedAt)
        ) {
          lastEnrichedAt = agg.lastEnriched;
        }
      }
      return {
        id: c.id,
        name: c.name,
        ownerName: c.ownerUser?.fullName ?? null,
        sharedDistrictCount: sharedLeaids.length,
        contactCount,
        lastEnrichedAt,
      };
    });

    // 5. Drop candidates with no contacts on the shared districts — they can't
    //    help the user find existing contacts.
    const withContacts = enriched.filter((r) => r.contactCount > 0);

    // 6. Rank: contactCount DESC, lastEnrichedAt DESC NULLS LAST, name ASC
    withContacts.sort((a, b) => {
      if (b.contactCount !== a.contactCount) {
        return b.contactCount - a.contactCount;
      }
      const aTime = a.lastEnrichedAt ? a.lastEnrichedAt.getTime() : -Infinity;
      const bTime = b.lastEnrichedAt ? b.lastEnrichedAt.getTime() : -Infinity;
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      return a.name.localeCompare(b.name);
    });

    // 7. Cap at top 10 and serialize
    const ranked = withContacts.slice(0, 10);

    return NextResponse.json({
      plans: ranked.map((p) => ({
        id: p.id,
        name: p.name,
        ownerName: p.ownerName,
        sharedDistrictCount: p.sharedDistrictCount,
        contactCount: p.contactCount,
        lastEnrichedAt: p.lastEnrichedAt
          ? p.lastEnrichedAt.toISOString()
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching plan contact sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact sources" },
      { status: 500 }
    );
  }
}
