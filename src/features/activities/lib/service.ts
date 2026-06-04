import prisma from "@/lib/prisma";
import { ServiceError, type DbClient } from "@/features/shared/lib/service-error";
import { findPlanIdsForDistricts } from "@/features/activities/lib/plan-linking";
import {
  ALL_ACTIVITY_TYPES,
  VALID_ACTIVITY_STATUSES,
  VALID_ACTIVITY_OUTCOMES,
  VALID_ACTIVITY_SENTIMENTS,
  VALID_DEAL_IMPACTS,
} from "@/features/activities/types";

/**
 * Activity mutation core. Extracted from the activity routes so the create and
 * the scalar-field update — the parts the AI copilot exercises — are shared and
 * carry the same validation + authorization. The routes keep their own
 * orchestration (relation replace-alls, road-trip auto-visits, Google Calendar
 * push, response shaping); the copilot calls these with a focused field subset
 * and does NOT push to calendar in v1.
 */

const CREATE_INCLUDE = {
  plans: { include: { plan: { select: { id: true, name: true, color: true } } } },
  districts: {
    include: { district: { select: { leaid: true, name: true, stateAbbrev: true } } },
  },
  contacts: { include: { contact: { select: { id: true, name: true, title: true } } } },
  states: { include: { state: { select: { fips: true, abbrev: true, name: true } } } },
  expenses: true,
  attendees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
  relations: {
    include: { relatedActivity: { select: { id: true, title: true, type: true, startDate: true, status: true } } },
  },
  relatedTo: {
    include: { activity: { select: { id: true, title: true, type: true, startDate: true, status: true } } },
  },
} as const;

interface ExpenseInput {
  description: string;
  amount: number;
  category?: string;
  incurredOn?: string;
  receiptStoragePath?: string | null;
}
interface DistrictDetailInput {
  leaid: string;
  visitDate?: string;
  visitEndDate?: string;
  position?: number;
  notes?: string;
  name?: string;
}

export interface CreateActivityInput {
  type?: string;
  title?: string;
  notes?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  planIds?: string[];
  districtLeaids?: string[];
  contactIds?: number[];
  stateFips?: string[];
  metadata?: unknown;
  address?: string | null;
  addressLat?: number | null;
  addressLng?: number | null;
  inPerson?: boolean | null;
  attendeeUserIds?: string[];
  expenses?: ExpenseInput[];
  districts?: DistrictDetailInput[];
  relatedActivityIds?: { activityId: string; relationType?: string }[];
  outcome?: string | null;
  outcomeType?: string | null;
  rating?: number | null;
}

export async function createActivity(input: CreateActivityInput, userId: string, db: DbClient = prisma) {
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
    stateFips = [],
    metadata = null,
    address = null,
    addressLat = null,
    addressLng = null,
    inPerson = null,
    attendeeUserIds = [],
    expenses = [],
    districts: districtDetails = [],
    relatedActivityIds = [],
    outcome = null,
    outcomeType = null,
    rating = null,
  } = input;

  if (!type || !title) {
    throw new ServiceError("type and title are required", 400);
  }
  if (!(ALL_ACTIVITY_TYPES as readonly string[]).includes(type)) {
    throw new ServiceError(`Invalid activity type: ${type}`, 400);
  }
  if (status && !(VALID_ACTIVITY_STATUSES as readonly string[]).includes(status)) {
    throw new ServiceError(`status must be one of: ${VALID_ACTIVITY_STATUSES.join(", ")}`, 400);
  }

  // Derive states from linked districts.
  const derivedStates = new Set<string>();
  if (districtLeaids.length > 0) {
    const districts = await db.district.findMany({
      where: { leaid: { in: districtLeaids } },
      select: { stateFips: true },
    });
    districts.forEach((d) => derivedStates.add(d.stateFips));
  }

  const districtDetailsMap = new Map(districtDetails.map((d) => [d.leaid, d]));
  const allDistrictLeaids = [
    ...new Set([...districtLeaids, ...districtDetails.map((d) => d.leaid)]),
  ];

  // Auto-link: attach this activity to every plan that contains any of its
  // districts (in addition to caller-supplied planIds), deduped.
  const autoPlanIds = await findPlanIdsForDistricts(allDistrictLeaids, db);
  const mergedPlanIds = [...new Set([...planIds, ...autoPlanIds])];

  return db.activity.create({
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
      createdByUserId: userId,
      plans: { create: mergedPlanIds.map((planId) => ({ planId })) },
      districts: {
        create: allDistrictLeaids.map((leaid) => {
          const detail = districtDetailsMap.get(leaid);
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
      contacts: { create: contactIds.map((contactId) => ({ contactId })) },
      states: {
        create: [
          ...[...derivedStates].map((fips) => ({ stateFips: fips, isExplicit: false })),
          ...stateFips
            .filter((fips) => !derivedStates.has(fips))
            .map((fips) => ({ stateFips: fips, isExplicit: true })),
        ],
      },
      expenses: {
        create: expenses.map((e) => ({
          description: e.description,
          amount: e.amount,
          category: e.category ?? "other",
          incurredOn: e.incurredOn ? new Date(e.incurredOn) : new Date(),
          receiptStoragePath: e.receiptStoragePath ?? null,
          createdById: userId,
        })),
      },
      attendees: { create: attendeeUserIds.map((id) => ({ userId: id })) },
      relations: {
        create: relatedActivityIds.map((r) => ({
          relatedActivityId: r.activityId,
          relationType: r.relationType || "related",
        })),
      },
    },
    include: CREATE_INCLUDE,
  });
}

export interface UpdateActivityInput {
  type?: string;
  title?: string;
  notes?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  outcome?: string | null;
  outcomeType?: string | null;
  sentiment?: string | null;
  nextStep?: string | null;
  followUpDate?: string | null;
  dealImpact?: string | null;
  outcomeDisposition?: string | null;
  address?: string | null;
  addressLat?: number | null;
  addressLng?: number | null;
  inPerson?: boolean | null;
  metadata?: unknown;
  rating?: number | null;
  createdByUserId?: string | null;
}

/**
 * Scalar-field update + validation + owner/admin authorization. Relation
 * replace-alls (attendees/contacts/expenses/districts/opportunities) remain in
 * the route, which calls this first and then reconciles links.
 */
export async function updateActivity(
  id: string,
  input: UpdateActivityInput,
  userId: string,
  isAdmin: () => Promise<boolean>,
  db: DbClient = prisma,
) {
  const existing = await db.activity.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Activity not found", 404);
  }
  if (existing.createdByUserId && existing.createdByUserId !== userId && !(await isAdmin())) {
    throw new ServiceError("Not authorized to edit this activity", 403);
  }

  const {
    type, title, notes, startDate, endDate, status, outcome, outcomeType,
    sentiment, nextStep, followUpDate, dealImpact, outcomeDisposition,
    address, addressLat, addressLng, inPerson, metadata, rating, createdByUserId,
  } = input;

  if (createdByUserId !== undefined && createdByUserId !== null) {
    const newOwner = await db.userProfile.findUnique({
      where: { id: createdByUserId },
      select: { id: true },
    });
    if (!newOwner) {
      throw new ServiceError("invalid_owner", 400);
    }
  }

  if (type && type !== existing.type && !(ALL_ACTIVITY_TYPES as readonly string[]).includes(type)) {
    throw new ServiceError(`Invalid activity type: ${type}`, 400);
  }
  if (status && !(VALID_ACTIVITY_STATUSES as readonly string[]).includes(status)) {
    throw new ServiceError(`status must be one of: ${VALID_ACTIVITY_STATUSES.join(", ")}`, 400);
  }
  if (startDate !== undefined && startDate !== null && Number.isNaN(new Date(startDate).getTime())) {
    throw new ServiceError("startDate must be a valid date", 400);
  }
  if (endDate !== undefined && endDate !== null && Number.isNaN(new Date(endDate).getTime())) {
    throw new ServiceError("endDate must be a valid date", 400);
  }
  if (rating !== undefined && rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new ServiceError("rating must be an integer between 1 and 5", 400);
  }
  if (sentiment != null && sentiment !== "" && !(VALID_ACTIVITY_SENTIMENTS as readonly string[]).includes(sentiment)) {
    throw new ServiceError(`sentiment must be one of: ${VALID_ACTIVITY_SENTIMENTS.join(", ")}`, 400);
  }
  if (dealImpact != null && dealImpact !== "" && !(VALID_DEAL_IMPACTS as readonly string[]).includes(dealImpact)) {
    throw new ServiceError(`dealImpact must be one of: ${VALID_DEAL_IMPACTS.join(", ")}`, 400);
  }
  if (outcomeDisposition != null && outcomeDisposition !== "" && !(VALID_ACTIVITY_OUTCOMES as readonly string[]).includes(outcomeDisposition)) {
    throw new ServiceError(`outcomeDisposition must be one of: ${VALID_ACTIVITY_OUTCOMES.join(", ")}`, 400);
  }
  if (followUpDate !== undefined && followUpDate !== null && followUpDate !== "" && Number.isNaN(new Date(followUpDate).getTime())) {
    throw new ServiceError("followUpDate must be a valid date", 400);
  }

  return db.activity.update({
    where: { id },
    data: {
      ...(type && { type }),
      ...(title && { title: title.trim() }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(status && { status }),
      ...(outcome !== undefined && { outcome: outcome?.trim() || null }),
      ...(outcomeType !== undefined && { outcomeType: outcomeType || null }),
      ...(sentiment !== undefined && { sentiment: sentiment || null }),
      ...(nextStep !== undefined && { nextStep: nextStep?.trim() || null }),
      ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
      ...(dealImpact !== undefined && dealImpact !== null && dealImpact !== "" && { dealImpact }),
      ...(outcomeDisposition !== undefined && { outcomeDisposition: outcomeDisposition || null }),
      ...(address !== undefined && { address: typeof address === "string" ? address.trim() || null : null }),
      ...(addressLat !== undefined && { addressLat: addressLat === null ? null : Number(addressLat) }),
      ...(addressLng !== undefined && { addressLng: addressLng === null ? null : Number(addressLng) }),
      ...(inPerson !== undefined && { inPerson: inPerson === null ? null : Boolean(inPerson) }),
      ...(metadata !== undefined && { metadata: metadata as never }),
      ...(rating !== undefined && { rating }),
      ...(createdByUserId !== undefined && { createdByUserId }),
    },
  });
}
