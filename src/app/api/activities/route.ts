import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getCategoryForType, ACTIVITY_CATEGORIES, ALL_ACTIVITY_TYPES, VALID_ACTIVITY_STATUSES, type ActivityCategory, type ActivityType } from "@/features/activities/types";
import { pushActivityToCalendar } from "@/features/calendar/lib/push";

export const dynamic = "force-dynamic";

// Parse a `?key=a,b,c` query param into a non-empty string[]. Repeated params
// (`?key=a&key=b`) are also accepted and merged. Empty values are dropped so
// a stray `?status=` doesn't widen the filter to "everything".
function readMulti(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.getAll(key);
  return raw
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// GET /api/activities - List activities with filtering
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Multi-value filters: client serializes arrays as CSV (`?status=a,b`) so
    // we parse them all up-front. Single-value form (`?status=a`) works too —
    // readMulti always returns a string[].
    const categories = readMulti(searchParams, "category") as ActivityCategory[];
    const types = readMulti(searchParams, "type");
    const statuses = readMulti(searchParams, "status");
    const states = readMulti(searchParams, "state");
    // Back-compat aliases — older callers sent `stateAbbrev` (URL) or
    // `stateCode` (queries.ts client). Treat both as `state`.
    const stateAbbrev = searchParams.get("stateAbbrev");
    if (stateAbbrev) states.push(stateAbbrev);
    const stateCode = searchParams.get("stateCode");
    if (stateCode) states.push(stateCode);
    const owners = readMulti(searchParams, "owner");
    const territories = readMulti(searchParams, "territory");
    const tags = readMulti(searchParams, "tags");
    const dealKinds = readMulti(searchParams, "dealKinds");
    const districtLeaids = readMulti(searchParams, "districtLeaids");
    const attendeeIds = readMulti(searchParams, "attendeeIds");
    const contactIds = readMulti(searchParams, "contactIds")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    const inPersonValues = readMulti(searchParams, "inPerson");

    const planId = searchParams.get("planId");
    const districtLeaid = searchParams.get("districtLeaid");
    const needsPlanAssociation = searchParams.get("needsPlanAssociation") === "true";
    const hasUnlinkedDistricts = searchParams.get("hasUnlinkedDistricts") === "true";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const startDateFrom = searchParams.get("startDateFrom");
    const startDateTo = searchParams.get("startDateTo");
    const unscheduled = searchParams.get("unscheduled") === "true";
    const search = searchParams.get("search");
    const source = searchParams.get("source");
    const ownerId = searchParams.get("ownerId"); // specific user ID, "all", or null (defaults to current user)
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    // Table-view sort. The whitelist mirrors ActivitySortKey in the
    // shared types — anything else falls through to the default (date desc).
    const ALLOWED_SORT_KEYS = ["date", "type", "title", "district", "owner", "status"] as const;
    type SortKey = typeof ALLOWED_SORT_KEYS[number];
    const sortByRaw = searchParams.get("sortBy");
    const sortBy: SortKey = (ALLOWED_SORT_KEYS as readonly string[]).includes(sortByRaw ?? "")
      ? (sortByRaw as SortKey)
      : "date";
    const sortDir: "asc" | "desc" = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    // Build where clause
    // When filtering by planId, show ALL activities in that plan (not just the user's)
    // as long as the user has access to the plan (owner or collaborator).
    const where: Prisma.ActivityWhereInput = {
      source: { not: "system" },
    };

    if (planId) {
      // Show all activities in the plan, regardless of who created them
      where.plans = { some: { planId } };
    } else if (owners.length > 0) {
      // Multi-select owner filter wins over the legacy single-value path.
      where.createdByUserId = { in: owners };
    } else if (ownerId === "all") {
      // Show everyone's activities
    } else if (ownerId) {
      // Show a specific user's activities
      where.createdByUserId = ownerId;
    } else {
      // Default — show only the current user's activities
      where.createdByUserId = user.id;
    }

    // Search across title, notes, and outcome (case-insensitive contains).
    // OR'd into the where so a row matching ANY of the three fields appears.
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { outcome: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by contact id list (Table view).
    if (contactIds.length > 0) {
      where.contacts = { some: { contactId: { in: contactIds } } };
    }

    // Filter by category (maps each category to its types). When both
    // category and explicit type are present, take the union of all types
    // so reps can ask for "meetings + this one event type" in one click.
    const categoryTypes: string[] = [];
    for (const c of categories) {
      if (ACTIVITY_CATEGORIES[c]) {
        categoryTypes.push(...(ACTIVITY_CATEGORIES[c] as unknown as string[]));
      }
    }
    const allTypes = [...new Set([...categoryTypes, ...types])];
    if (allTypes.length > 0) {
      where.type = { in: allTypes };
    }

    // Filter by district — single (legacy) and multi (new). When both are
    // present, the multi list wins; the single param is treated as one entry.
    const allDistrictLeaids = districtLeaid
      ? [...new Set([districtLeaid, ...districtLeaids])]
      : districtLeaids;
    if (allDistrictLeaids.length === 1) {
      where.districts = { some: { districtLeaid: allDistrictLeaids[0] } };
    } else if (allDistrictLeaids.length > 1) {
      where.districts = { some: { districtLeaid: { in: allDistrictLeaids } } };
    }

    // Filter by state — accepts a list of abbreviations (`CA,NY`).
    if (states.length > 0) {
      where.states = {
        some: { state: { abbrev: { in: states } } },
      };
    }

    // Filter by attendee user IDs.
    if (attendeeIds.length > 0) {
      where.attendees = { some: { userId: { in: attendeeIds } } };
    }

    // Filter by in-person flag. Empty array → no filter. ["yes"] / ["no"] →
    // exact boolean match. Both → exclude unset (null) entries.
    if (inPersonValues.length === 1) {
      where.inPerson = inPersonValues[0] === "yes";
    } else if (inPersonValues.length > 1) {
      where.inPerson = { not: null };
    }

    // Filter by status
    if (statuses.length === 1) {
      where.status = statuses[0];
    } else if (statuses.length > 1) {
      where.status = { in: statuses };
    }

    // Filter by source
    if (source) {
      where.source = source;
    }

    // Filter by territory (matches plan territory names linked through
    // ActivityPlan). Skip when planId is already set — a single-plan filter
    // is a stricter constraint than a territory list and the two would
    // otherwise overwrite each other.
    if (territories.length > 0 && !planId) {
      where.plans = {
        some: { plan: { name: { in: territories } } },
      };
    }

    // Tags + dealKinds aren't backed by columns yet — accept the params so
    // the client URL is stable, but log when they're set so we know if/when
    // a downstream wave needs to wire them up.
    if (tags.length > 0 || dealKinds.length > 0) {
      // Intentionally a no-op until those features land. The params are
      // already round-tripped through saved views via the URL.
    }

    // Filter for unscheduled activities (no startDate)
    if (unscheduled) {
      where.startDate = null;
    } else if (startDate && endDate) {
      // Filter by date range
      // When both startDate and endDate are provided, find activities that overlap with the range
      where.AND = [
        { startDate: { not: null, gte: new Date(startDate) } },
        {
          OR: [
            { endDate: { lte: new Date(endDate) } },
            { endDate: null, startDate: { lte: new Date(endDate) } },
          ],
        },
      ];
    } else if (startDate) {
      where.startDate = { not: null, gte: new Date(startDate) };
    } else if (endDate) {
      where.OR = [
        { endDate: { lte: new Date(endDate) } },
        { endDate: null, startDate: { not: null, lte: new Date(endDate) } },
      ];
    } else if (startDateFrom || startDateTo) {
      // Table view sends a free-form startDate range (either bound may be
      // missing). Activities must have a startDate within the bounds.
      const range: Prisma.DateTimeNullableFilter = { not: null };
      if (startDateFrom) range.gte = new Date(startDateFrom);
      if (startDateTo) {
        // Inclusive end-of-day for the To bound so `2026-05-05` includes the
        // full day in the user's timezone-relative view.
        const to = new Date(startDateTo);
        to.setHours(23, 59, 59, 999);
        range.lte = to;
      }
      where.startDate = range;
    }

    // Resolve orderBy from sortBy/sortDir.
    //
    // - `district` falls back to title: Prisma can't natively orderBy on a
    //   list relation's `name` field and our schema has no denormalized
    //   first-district column. The header still reads "District" but the
    //   rows order alphabetically by activity title under the hood.
    // - `owner` falls back to `createdByUserId`: Activity carries the FK
    //   scalar but has no `createdByUser` relation in the schema, so a
    //   true name-sort would require a denormalized column or post-fetch
    //   ordering. UUID-sort at least groups same-owner rows together.
    let orderBy: Prisma.ActivityOrderByWithRelationInput | Prisma.ActivityOrderByWithRelationInput[];
    switch (sortBy) {
      case "type":
        orderBy = [{ type: sortDir }, { startDate: { sort: "desc", nulls: "last" } }];
        break;
      case "title":
        orderBy = [{ title: sortDir }];
        break;
      case "status":
        orderBy = [{ status: sortDir }, { startDate: { sort: "desc", nulls: "last" } }];
        break;
      case "owner":
        orderBy = [{ createdByUserId: sortDir }, { startDate: { sort: "desc", nulls: "last" } }];
        break;
      case "district":
        orderBy = [{ title: sortDir }];
        break;
      case "date":
      default:
        orderBy = [
          { startDate: { sort: sortDir, nulls: "last" } },
          { createdAt: sortDir },
        ];
    }

    const queryStart = Date.now();

    // Run count and findMany in parallel for better performance
    // Using select instead of include to fetch only what's needed for the list view
    const [totalInDb, activities] = await Promise.all([
      // Query 1: Get total count for pagination (before computed filters)
      prisma.activity.count({ where }),

      // Query 2: Fetch activities with minimal data needed for list view
      prisma.activity.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          startDate: true,
          endDate: true,
          status: true,
          source: true,
          outcomeType: true,
          // Table-view denormalizations: notes/outcome power outcomePreview;
          // first-district name + first-contact name + owner name avoid an
          // N+1 in the row renderer. Older calendar views ignore these.
          notes: true,
          outcome: true,
          createdByUserId: true,
          plans: {
            select: { planId: true },
          },
          districts: {
            select: {
              districtLeaid: true,
              warningDismissed: true,
              position: true,
              district: { select: { name: true } },
            },
            orderBy: { position: "asc" },
          },
          contacts: {
            select: { contact: { select: { name: true } } },
            take: 1,
          },
          states: {
            select: {
              state: { select: { abbrev: true } },
            },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
    ]);

    const mainQueryTime = Date.now() - queryStart;

    // Get all plan districts for computing hasUnlinkedDistricts
    // This query is fast since we're only fetching IDs
    const planDistrictsStart = Date.now();
    const planIds = [...new Set(activities.flatMap((a) => a.plans.map((p) => p.planId)))];

    // Only run this query if there are plans to check
    const planDistricts = planIds.length > 0
      ? await prisma.territoryPlanDistrict.findMany({
          where: { planId: { in: planIds } },
          select: { planId: true, districtLeaid: true },
        })
      : [];

    const planDistrictsTime = Date.now() - planDistrictsStart;

    // Map plan -> set of district leaids
    const planDistrictMap = new Map<string, Set<string>>();
    for (const pd of planDistricts) {
      if (!planDistrictMap.has(pd.planId)) {
        planDistrictMap.set(pd.planId, new Set());
      }
      planDistrictMap.get(pd.planId)!.add(pd.districtLeaid);
    }

    // Batch-fetch owner display names for the Table view's Owner column.
    // Activity carries `createdByUserId` as a scalar (no relation), so we
    // resolve names here in a single query rather than per-row.
    const ownerIds = [
      ...new Set(
        activities
          .map((a) => a.createdByUserId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const ownerProfiles = ownerIds.length > 0
      ? await prisma.userProfile.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const ownerNameById = new Map<string, string>();
    for (const p of ownerProfiles) {
      ownerNameById.set(p.id, p.fullName ?? p.email);
    }

    // Transform and filter by computed flags
    const transformed = activities
      .map((activity) => {
        const activityPlanIds = activity.plans.map((p) => p.planId);
        const needsPlan = activity.plans.length === 0;

        // Check if any district is not in any of the activity's plans
        const hasUnlinked = activity.districts.some((ad) => {
          if (ad.warningDismissed) return false;
          return !activityPlanIds.some((planId) =>
            planDistrictMap.get(planId)?.has(ad.districtLeaid)
          );
        });

        const firstDistrict = activity.districts[0]?.district?.name ?? null;
        const firstContact = activity.contacts[0]?.contact?.name ?? null;
        const ownerFullName = activity.createdByUserId
          ? ownerNameById.get(activity.createdByUserId) ?? null
          : null;
        const previewSource = activity.outcome?.trim() || activity.notes?.trim() || null;
        const outcomePreview = previewSource
          ? previewSource.length > 80
            ? `${previewSource.slice(0, 80)}…`
            : previewSource
          : null;

        return {
          id: activity.id,
          type: activity.type as ActivityType,
          category: getCategoryForType(activity.type as ActivityType),
          title: activity.title,
          startDate: activity.startDate?.toISOString() ?? null,
          endDate: activity.endDate?.toISOString() ?? null,
          status: activity.status,
          source: activity.source || "manual",
          outcomeType: activity.outcomeType,
          needsPlanAssociation: needsPlan,
          hasUnlinkedDistricts: hasUnlinked,
          planCount: activity.plans.length,
          districtCount: activity.districts.length,
          stateAbbrevs: activity.states.map((s) => s.state.abbrev),
          // Table-view denormalizations
          createdByUserId: activity.createdByUserId,
          ownerFullName,
          districtName: firstDistrict,
          contactName: firstContact,
          outcomePreview,
        };
      })
      .filter((a) => {
        if (needsPlanAssociation && !a.needsPlanAssociation) return false;
        if (hasUnlinkedDistricts && !a.hasUnlinkedDistricts) return false;
        return true;
      });

    const totalTime = Date.now() - startTime;

    // Log timing in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.log(`[Activities API] Total: ${totalTime}ms | Main query: ${mainQueryTime}ms | Plan districts: ${planDistrictsTime}ms | Count: ${activities.length}`);
    }

    return NextResponse.json({
      activities: transformed,
      total: transformed.length,
      totalInDb, // total matching the base filters, before computed flag filtering
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    // Return more details in development
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: "Failed to fetch activities",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      title,
      notes,
      startDate,
      endDate,
      status = "planned",
      planIds = [],
      districtLeaids = [],
      contactIds = [],
      stateFips = [], // explicit states
      metadata = null,
      address = null,
      addressLat = null,
      addressLng = null,
      inPerson = null,
      attendeeUserIds = [],
      expenses = [],
      districts: districtDetails = [],
      relatedActivityIds = [], // [{activityId, relationType}] // [{leaid, visitDate?, visitEndDate?}]
      outcome = null,
      outcomeType = null,
      rating = null,
    } = body;

    // Validate required fields
    if (!type || !title) {
      return NextResponse.json(
        { error: "type and title are required" },
        { status: 400 }
      );
    }

    // Validate type is valid
    if (!ALL_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid activity type: ${type}` },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status && !VALID_ACTIVITY_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_ACTIVITY_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Get states derived from districts
    const derivedStates = new Set<string>();
    if (districtLeaids.length > 0) {
      const districts = await prisma.district.findMany({
        where: { leaid: { in: districtLeaids } },
        select: { stateFips: true },
      });
      districts.forEach((d) => derivedStates.add(d.stateFips));
    }

    // Build district create entries — merge districtLeaids with districtDetails (which may have visit dates)
    const districtDetailsMap = new Map(
      districtDetails.map((d: { leaid: string; visitDate?: string; visitEndDate?: string; position?: number; notes?: string; name?: string }) => [d.leaid, d])
    );
    const allDistrictLeaids = [...new Set([...districtLeaids, ...districtDetails.map((d: { leaid: string }) => d.leaid)])];

    // Create activity with all relations
    const activity = await prisma.activity.create({
      data: {
        type,
        title: title.trim(),
        notes: notes?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status,
        outcome: outcome?.trim() || null,
        outcomeType: outcomeType || null,
        rating: rating != null ? Number(rating) : null,
        address: typeof address === "string" ? address.trim() || null : null,
        addressLat: addressLat == null ? null : Number(addressLat),
        addressLng: addressLng == null ? null : Number(addressLng),
        inPerson: inPerson == null ? null : Boolean(inPerson),
        metadata: metadata || undefined,
        createdByUserId: user.id,
        plans: {
          create: planIds.map((planId: string) => ({ planId })),
        },
        districts: {
          create: allDistrictLeaids.map((leaid: string) => {
            const detail = districtDetailsMap.get(leaid) as { visitDate?: string; visitEndDate?: string; position?: number; notes?: string } | undefined;
            return {
              districtLeaid: leaid,
              warningDismissed: false,
              visitDate: detail?.visitDate ? new Date(detail.visitDate) : null,
              visitEndDate: detail?.visitEndDate ? new Date(detail.visitEndDate) : null,
              position: detail?.position ?? 0,
              notes: detail?.notes?.trim() || null,
            };
          }),
        },
        contacts: {
          create: contactIds.map((contactId: number) => ({ contactId })),
        },
        states: {
          create: [
            // Derived states (from districts)
            ...[...derivedStates].map((fips) => ({
              stateFips: fips,
              isExplicit: false,
            })),
            // Explicit states (user-added)
            ...stateFips
              .filter((fips: string) => !derivedStates.has(fips))
              .map((fips: string) => ({
                stateFips: fips,
                isExplicit: true,
              })),
          ],
        },
        expenses: {
          // Legacy callers send `{description, amount}` only; the new schema
          // requires `incurredOn` (defaulted to "now") and a `category`
          // (defaults to "other" via column DEFAULT).
          create: (expenses as Array<{
            description: string;
            amount: number;
            category?: string;
            incurredOn?: string;
            receiptStoragePath?: string | null;
          }>).map((e) => ({
            description: e.description,
            amount: e.amount,
            category: e.category ?? "other",
            incurredOn: e.incurredOn ? new Date(e.incurredOn) : new Date(),
            receiptStoragePath: e.receiptStoragePath ?? null,
            createdById: user.id,
          })),
        },
        attendees: {
          create: attendeeUserIds.map((userId: string) => ({ userId })),
        },
        relations: {
          create: relatedActivityIds.map((r: { activityId: string; relationType?: string }) => ({
            relatedActivityId: r.activityId,
            relationType: r.relationType || "related",
          })),
        },
      },
      include: {
        plans: {
          include: { plan: { select: { id: true, name: true, color: true } } },
        },
        districts: {
          include: {
            district: { select: { leaid: true, name: true, stateAbbrev: true } },
          },
        },
        contacts: {
          include: { contact: { select: { id: true, name: true, title: true } } },
        },
        states: {
          include: { state: { select: { fips: true, abbrev: true, name: true } } },
        },
        expenses: true,
        attendees: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
        relations: {
          include: { relatedActivity: { select: { id: true, title: true, type: true, startDate: true, status: true } } },
        },
        relatedTo: {
          include: { activity: { select: { id: true, title: true, type: true, startDate: true, status: true } } },
        },
      },
    });

    // Auto-create Visit activities for road trip stops that have visit dates
    if (type === "road_trip") {
      const districtsWithDates = districtDetails.filter(
        (d: { leaid: string; visitDate?: string; name?: string }) => d.visitDate
      );

      if (districtsWithDates.length > 0) {
        // Look up district details (name, state) for all stops that need visits
        const stopLeaids = districtsWithDates.map((d: { leaid: string }) => d.leaid);
        const stopDistricts = await prisma.district.findMany({
          where: { leaid: { in: stopLeaids } },
          select: { leaid: true, name: true, stateFips: true },
        });
        const stopDistrictMap = new Map(stopDistricts.map((d) => [d.leaid, d]));

        for (const stop of districtsWithDates as { leaid: string; visitDate: string; name?: string }[]) {
          const districtInfo = stopDistrictMap.get(stop.leaid);
          const districtName = stop.name || districtInfo?.name || stop.leaid;

          await prisma.activity.create({
            data: {
              type: "school_site_visit",
              title: `Visit: ${districtName}`,
              startDate: new Date(stop.visitDate),
              status: "planned",
              createdByUserId: user.id,
              plans: {
                create: planIds.map((planId: string) => ({ planId })),
              },
              districts: {
                create: [{ districtLeaid: stop.leaid }],
              },
              states: {
                create: districtInfo
                  ? [{ stateFips: districtInfo.stateFips, isExplicit: false }]
                  : [],
              },
              relatedTo: {
                create: [{
                  activityId: activity.id,
                  relationType: "part_of",
                }],
              },
            },
          });
        }
      }
    }

    // Push to Google Calendar if user has a connected calendar
    // This is best-effort — if it fails, the activity is still created
    pushActivityToCalendar(user.id, activity.id);

    // Transform the activity response inline (type-safe via Prisma inference)
    return NextResponse.json({
      id: activity.id,
      type: activity.type,
      category: getCategoryForType(activity.type as ActivityType),
      title: activity.title,
      notes: activity.notes,
      startDate: activity.startDate?.toISOString() ?? null,
      endDate: activity.endDate?.toISOString() ?? null,
      status: activity.status,
      address: activity.address,
      addressLat: activity.addressLat,
      addressLng: activity.addressLng,
      inPerson: activity.inPerson,
      metadata: activity.metadata,
      createdByUserId: activity.createdByUserId,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      needsPlanAssociation: activity.plans.length === 0,
      hasUnlinkedDistricts: false, // Will be computed on fetch
      plans: activity.plans.map((p) => ({
        planId: p.plan.id,
        planName: p.plan.name,
        planColor: p.plan.color,
      })),
      districts: activity.districts.map((d) => ({
        leaid: d.district.leaid,
        name: d.district.name,
        stateAbbrev: d.district.stateAbbrev,
        warningDismissed: d.warningDismissed,
        isInPlan: false, // Will be computed on fetch
        visitDate: d.visitDate?.toISOString() ?? null,
        visitEndDate: d.visitEndDate?.toISOString() ?? null,
        position: d.position,
        notes: d.notes,
      })),
      contacts: activity.contacts.map((c) => ({
        id: c.contact.id,
        name: c.contact.name,
        title: c.contact.title,
      })),
      states: activity.states.map((s) => ({
        fips: s.state.fips,
        abbrev: s.state.abbrev,
        name: s.state.name,
        isExplicit: s.isExplicit,
      })),
      expenses: activity.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        amountCents: Math.round(Number(e.amount) * 100),
        category: e.category,
        incurredOn: e.incurredOn.toISOString(),
        receiptStoragePath: e.receiptStoragePath,
        createdById: e.createdById,
      })),
      attendees: activity.attendees.map((a) => ({
        userId: a.user.id,
        fullName: a.user.fullName,
        avatarUrl: a.user.avatarUrl,
      })),
      relatedActivities: [
        ...activity.relations.map((r) => ({
          activityId: r.relatedActivity.id,
          title: r.relatedActivity.title,
          type: r.relatedActivity.type as ActivityType,
          startDate: r.relatedActivity.startDate?.toISOString() ?? null,
          status: r.relatedActivity.status,
          relationType: r.relationType,
        })),
        ...activity.relatedTo.map((r) => ({
          activityId: r.activity.id,
          title: r.activity.title,
          type: r.activity.type as ActivityType,
          startDate: r.activity.startDate?.toISOString() ?? null,
          status: r.activity.status,
          relationType: r.relationType,
        })),
      ],
    });
  } catch (error) {
    console.error("Error creating activity:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create activity: ${detail}` },
      { status: 500 }
    );
  }
}
