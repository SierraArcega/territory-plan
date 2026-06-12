import { randomUUID } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ServiceError, type DbClient } from "@/features/shared/lib/service-error";
import { ALL_ACTIVITY_TYPES } from "@/features/activities/types";
import { LEAD_TRANSITIONS, OPP_ADVANCED_MESSAGE } from "@/features/leads/lib/status-config";

/**
 * Lead mutation core (BDR pipeline). All lifecycle side-effects — accepting,
 * creating/advancing the native Stage 0 opportunity, disqualifying — live here
 * so every caller (REST routes, imports) shares the same validation and the
 * same invariant: engagement data (activities + junctions) is NEVER deleted or
 * modified by a lead transition. Only lifecycle events (lead_events) belong to
 * the lead.
 */

// ---- Status & transition table --------------------------------------------

export const LEAD_STATUSES = [
  "new",
  "working",
  "meeting_scheduled",
  "sales_qualified",
  "unqualified",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Statuses still on the BDR pipeline — a contact may hold at most one. */
export const ACTIVE_LEAD_STATUSES = [
  "new",
  "working",
  "meeting_scheduled",
] as const satisfies readonly LeadStatus[];

export const LEAD_TYPES = ["mql", "inbound", "conference", "other"] as const;

// Transition table — single source of truth in status-config (client + server
// share it so the UI's offered choices and this validation can't drift).
// Anything not in the table is a 422.
export { LEAD_TRANSITIONS };

// ---- Opportunity constants -------------------------------------------------
// Exact existing stage strings (src/features/views/lib/opp-stage-columns.ts).

export const LEAD_OPP_STAGE_MEETING_BOOKED = "0 - Meeting Booked";
export const LEAD_OPP_STAGE_DISCOVERY = "1 - Discovery";
/** Written to opportunities.lead_source so lead-created opps are identifiable. */
export const LEAD_CREATED_OPP_SOURCE = "Lead Pipeline";
// Shared with the client toast — single source of truth in status-config.
export { OPP_ADVANCED_MESSAGE };
const CLOSED_OPP_STAGES = ["Closed Won", "Closed Lost"];

// ---- Shared include / serializer -------------------------------------------

export const LEAD_INCLUDE = {
  contact: {
    select: { id: true, name: true, title: true, email: true, phone: true, schoolNcessch: true },
  },
  school: { select: { ncessch: true, schoolName: true } },
  district: { select: { leaid: true, name: true, cityLocation: true, stateAbbrev: true } },
  assignedBdr: { select: { id: true, fullName: true, avatarUrl: true } },
  opportunity: {
    select: { id: true, name: true, stage: true, netBookingAmount: true, closeDate: true },
  },
} as const satisfies Prisma.LeadInclude;

export type LeadWithRelations = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

/** JSON shape shared by every lead-returning route. */
export function serializeLead(lead: LeadWithRelations) {
  return {
    id: lead.id,
    status: lead.status,
    score: lead.score,
    leadType: lead.leadType,
    sequence: lead.sequence,
    marketingOwner: lead.marketingOwner,
    unqualifiedReason: lead.unqualifiedReason,
    meetingAt: lead.meetingAt?.toISOString() ?? null,
    assignedAt: lead.assignedAt.toISOString(),
    acceptedAt: lead.acceptedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    contact: lead.contact
      ? {
          id: lead.contact.id,
          name: lead.contact.name,
          title: lead.contact.title,
          email: lead.contact.email,
          phone: lead.contact.phone,
        }
      : null,
    school: lead.school
      ? { ncessch: lead.school.ncessch, name: lead.school.schoolName }
      : null,
    district: lead.district
      ? {
          leaid: lead.district.leaid,
          name: lead.district.name,
          city: lead.district.cityLocation,
          stateAbbrev: lead.district.stateAbbrev,
        }
      : null,
    assignedBdr: lead.assignedBdr
      ? {
          id: lead.assignedBdr.id,
          fullName: lead.assignedBdr.fullName,
          avatarUrl: lead.assignedBdr.avatarUrl,
        }
      : null,
    opportunity: lead.opportunity
      ? {
          id: lead.opportunity.id,
          name: lead.opportunity.name,
          stage: lead.opportunity.stage,
          amount:
            lead.opportunity.netBookingAmount != null
              ? Number(lead.opportunity.netBookingAmount)
              : null,
          closeDate: lead.opportunity.closeDate?.toISOString() ?? null,
        }
      : null,
  };
}

// ---- Helpers ----------------------------------------------------------------

/**
 * Run `fn` inside a transaction when the caller handed us the full client;
 * if we're already inside one (TransactionClient), just run.
 */
async function withTx<T>(
  db: DbClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in db) {
    return (db as PrismaClient).$transaction(fn);
  }
  return fn(db);
}

export interface ContactRecencyFields {
  id: number;
  createdAt: Date;
  lastEnrichedAt: Date | null;
}

/**
 * Contacts have no unique email constraint and no updated_at. On duplicates,
 * pick the most recently touched row: lastEnrichedAt ?? createdAt desc, then
 * highest id as the deterministic tiebreaker. Shared with the import resolver
 * so manual creates and bulk imports cannot drift.
 */
export function pickMostRecentContact<T extends ContactRecencyFields>(contacts: T[]): T | null {
  if (contacts.length === 0) return null;
  return [...contacts].sort((a, b) => {
    const ta = (a.lastEnrichedAt ?? a.createdAt).getTime();
    const tb = (b.lastEnrichedAt ?? b.createdAt).getTime();
    if (tb !== ta) return tb - ta;
    return b.id - a.id;
  })[0];
}

type LeadWithDistrict = Prisma.LeadGetPayload<{
  include: { district: { select: { leaid: true; name: true } } };
}>;

interface OppOverrides {
  name?: string | null;
  amount?: number | null;
  closeDate?: string | null;
}

/**
 * Create the native Stage 0 opportunity for a lead. App-generated uuid can
 * never collide with the LMS sync's numeric-text ids, and the sync is
 * upsert-only, so the row survives. Tagged via lead_source for reporting.
 */
async function createStage0Opportunity(
  tx: Prisma.TransactionClient,
  lead: LeadWithDistrict,
  userId: string,
  overrides: OppOverrides,
) {
  return tx.opportunity.create({
    data: {
      id: randomUUID(),
      name: overrides.name?.trim() || `${lead.district.name} — Lead Pipeline`,
      stage: LEAD_OPP_STAGE_MEETING_BOOKED,
      districtLeaId: lead.leaid,
      districtName: lead.district.name,
      leadSource: LEAD_CREATED_OPP_SOURCE,
      salesRepId: lead.assignedBdrId ?? userId,
      netBookingAmount: overrides.amount ?? null,
      closeDate: overrides.closeDate ? new Date(overrides.closeDate) : null,
      createdAt: new Date(),
    },
  });
}

// ---- createLead --------------------------------------------------------------

export interface CreateLeadInput {
  leaid?: string;
  schoolNcessch?: string | null;
  contactId?: number;
  contactName?: string;
  contactTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  leadType?: string | null;
  sequence?: string | null;
  marketingOwner?: string | null;
  /** Defaults to the current user (UX rule: owner defaults to me). */
  assignedBdrId?: string | null;
  score?: number;
}

export async function createLead(
  input: CreateLeadInput,
  userId: string,
  db: DbClient = prisma,
): Promise<LeadWithRelations> {
  return withTx(db, async (tx) => {
    if (input.leadType && !(LEAD_TYPES as readonly string[]).includes(input.leadType)) {
      throw new ServiceError(`leadType must be one of: ${LEAD_TYPES.join(", ")}`, 400);
    }
    if (input.score != null && (!Number.isInteger(input.score) || input.score < 0)) {
      throw new ServiceError("score must be a non-negative integer", 400);
    }

    const assignedBdrId = input.assignedBdrId === undefined ? userId : input.assignedBdrId;
    if (assignedBdrId) {
      const bdr = await tx.userProfile.findUnique({
        where: { id: assignedBdrId },
        select: { id: true },
      });
      if (!bdr) throw new ServiceError("invalid_bdr", 400);
    }

    let leaid = input.leaid?.trim() || null;
    let schoolNcessch = input.schoolNcessch?.trim() || null;
    let contactId: number | null = null;

    if (input.contactId != null) {
      // Existing contact: its durable records win.
      const contact = await tx.contact.findUnique({
        where: { id: input.contactId },
        select: { id: true, leaid: true, schoolNcessch: true },
      });
      if (!contact) throw new ServiceError("contact_not_found", 400);
      contactId = contact.id;
      leaid = contact.leaid;
      schoolNcessch = schoolNcessch ?? contact.schoolNcessch;
      if (input.schoolNcessch) {
        const school = await tx.school.findUnique({
          where: { ncessch: schoolNcessch! },
          select: { ncessch: true },
        });
        if (!school) throw new ServiceError("school_not_found", 400);
      }
    } else {
      // New/looked-up contact: resolve the district, via the school when given.
      if (schoolNcessch) {
        const school = await tx.school.findUnique({
          where: { ncessch: schoolNcessch },
          select: { ncessch: true, leaid: true },
        });
        if (!school) throw new ServiceError("school_not_found", 400);
        leaid = school.leaid; // the school's district is authoritative
      }
      if (!leaid) throw new ServiceError("leaid or schoolNcessch is required", 400);
      const district = await tx.district.findUnique({
        where: { leaid },
        select: { leaid: true },
      });
      if (!district) throw new ServiceError("district_not_found", 400);

      const email = input.email?.trim() || null;
      if (email) {
        const matches = await tx.contact.findMany({
          where: { leaid, email: { equals: email, mode: "insensitive" } },
          select: { id: true, createdAt: true, lastEnrichedAt: true, schoolNcessch: true },
        });
        const picked = pickMostRecentContact(matches);
        if (picked) {
          contactId = picked.id;
          // Backfill the workplace school if the contact doesn't have one yet.
          if (!picked.schoolNcessch && schoolNcessch) {
            await tx.contact.update({ where: { id: picked.id }, data: { schoolNcessch } });
          }
        }
      }
      if (contactId == null) {
        const name = input.contactName?.trim();
        if (!name) throw new ServiceError("contactName is required to create a new contact", 400);
        const created = await tx.contact.create({
          data: {
            leaid,
            name,
            title: input.contactTitle?.trim() || null,
            email,
            phone: input.phone?.trim() || null,
            schoolNcessch,
          },
          select: { id: true },
        });
        contactId = created.id;
      }
    }

    const existingLead = await tx.lead.findFirst({
      where: { contactId, status: { in: [...ACTIVE_LEAD_STATUSES] } },
      select: { id: true },
    });
    if (existingLead) {
      throw new ServiceError("Contact already has an active lead", 409);
    }

    const lead = await tx.lead.create({
      data: {
        contactId,
        schoolNcessch,
        leaid: leaid!,
        leadType: input.leadType ?? null,
        sequence: input.sequence?.trim() || null,
        marketingOwner: input.marketingOwner?.trim() || null,
        assignedBdrId,
        score: input.score ?? 0,
      },
      include: LEAD_INCLUDE,
    });
    await tx.leadEvent.create({
      data: {
        leadId: lead.id,
        kind: "created",
        actorId: userId,
        payload: { assignedBdrId },
      },
    });
    return lead;
  });
}

// ---- transitionLead -----------------------------------------------------------

export interface TransitionLeadInput {
  status?: string;
  /** Required when transitioning to unqualified. */
  reason?: string | null;
  /** Optional meeting date (ISO string) when transitioning to meeting_scheduled. */
  meetingAt?: string | null;
}

interface TransitionOptions {
  reason?: string | null;
  meetingAt?: string | null;
}

/**
 * Core transition logic — shared by transitionLead and logEngagement so the
 * validation table and side-effects can never drift. Runs inside the caller's
 * transaction. Never deletes or modifies engagement data.
 */
async function applyTransition(
  tx: Prisma.TransactionClient,
  lead: LeadWithDistrict,
  target: LeadStatus,
  opts: TransitionOptions,
  userId: string,
): Promise<LeadWithRelations> {
  const from = lead.status as LeadStatus;
  if (from === target) {
    // Idempotent no-op (e.g. a re-dragged card) — no event written.
    return tx.lead.findUniqueOrThrow({ where: { id: lead.id }, include: LEAD_INCLUDE });
  }
  if (!LEAD_TRANSITIONS[from]?.includes(target)) {
    throw new ServiceError(`Cannot transition lead from ${from} to ${target}`, 422);
  }

  const data: Prisma.LeadUncheckedUpdateInput = { status: target };
  const events: { kind: string; payload: Prisma.InputJsonValue }[] = [];

  if (target === "working" && from === "new") {
    // Accept: the SLA clock stops here.
    data.acceptedAt = new Date();
    events.push({ kind: "accepted", payload: { from, to: target } });
  } else if (target === "new") {
    // Un-accept: back to awaiting acceptance. assigned_at is untouched —
    // the SLA still measures from the original assignment.
    data.acceptedAt = null;
    events.push({ kind: "restaged", payload: { from, to: target } });
  } else if (target === "unqualified") {
    const reason = opts.reason?.trim();
    if (!reason) {
      throw new ServiceError("A reason is required to disqualify a lead", 400);
    }
    // Engagement is preserved by construction (it lives on the records, not
    // the lead) — count it for the system note shown in the timeline.
    const preservedActivityCount = await tx.activity.count({
      where: {
        source: { not: "system" },
        OR: [
          { contacts: { some: { contactId: lead.contactId } } },
          { districts: { some: { districtLeaid: lead.leaid } } },
        ],
      },
    });
    data.unqualifiedReason = reason;
    events.push({
      kind: "disqualified",
      payload: {
        from,
        to: target,
        reason,
        preservedActivityCount,
        message: `${preservedActivityCount} activities preserved on contact + district`,
      },
    });
  } else {
    events.push({ kind: "restaged", payload: { from, to: target } });
    if (target === "meeting_scheduled" && opts.meetingAt != null) {
      const meetingAt = new Date(opts.meetingAt);
      if (Number.isNaN(meetingAt.getTime())) {
        throw new ServiceError("meetingAt must be a valid date", 400);
      }
      data.meetingAt = meetingAt;
    }
    // Leaving meeting_scheduled (back to working or onward) keeps meetingAt —
    // it's history; the UI only surfaces it while in stage.
    if (target === "meeting_scheduled" && !lead.opportunityId) {
      const opp = await createStage0Opportunity(tx, lead, userId, {});
      data.opportunityId = opp.id;
      events.push({
        kind: "opp_created",
        payload: { opportunityId: opp.id, stage: LEAD_OPP_STAGE_MEETING_BOOKED },
      });
    }
    if (target === "sales_qualified" && lead.opportunityId) {
      // Advance — never mark won. SQL hands the opp to a rep at Discovery.
      await tx.opportunity.update({
        where: { id: lead.opportunityId },
        data: { stage: LEAD_OPP_STAGE_DISCOVERY },
      });
      events.push({
        kind: "opp_advanced",
        payload: { opportunityId: lead.opportunityId, message: OPP_ADVANCED_MESSAGE },
      });
    }
  }

  const updated = await tx.lead.update({
    where: { id: lead.id },
    data,
    include: LEAD_INCLUDE,
  });
  for (const event of events) {
    await tx.leadEvent.create({
      data: { leadId: lead.id, kind: event.kind, payload: event.payload, actorId: userId },
    });
  }
  return updated;
}

export async function transitionLead(
  leadId: string,
  input: TransitionLeadInput,
  userId: string,
  db: DbClient = prisma,
): Promise<LeadWithRelations> {
  return withTx(db, async (tx) => {
    if (!input.status || !(LEAD_STATUSES as readonly string[]).includes(input.status)) {
      throw new ServiceError(`status must be one of: ${LEAD_STATUSES.join(", ")}`, 400);
    }
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      include: { district: { select: { leaid: true, name: true } } },
    });
    if (!lead) throw new ServiceError("Lead not found", 404);
    return applyTransition(
      tx,
      lead,
      input.status as LeadStatus,
      { reason: input.reason, meetingAt: input.meetingAt },
      userId,
    );
  });
}

// ---- logEngagement ------------------------------------------------------------

export interface LogEngagementInput {
  /** Activity type — must be one of ALL_ACTIVITY_TYPES (e.g. cold_call, email, discovery_call). */
  type?: string;
  title?: string;
  notes?: string | null;
  occurredAt?: string | null;
  /** Score increment for the lead (engagement points). Default 0. */
  points?: number;
  outcome?: string | null;
  outcomeType?: string | null;
  rating?: number | null;
  /** Optional lifecycle transition applied after logging (validated). */
  resultingStatus?: string | null;
  /** Required when resultingStatus is unqualified. */
  reason?: string | null;
}

/**
 * Log an engagement outcome: a REAL activities row + contact/district/school
 * junctions (never owned by the lead), a score increment, and an optional
 * status transition — all in one transaction.
 */
export async function logEngagement(
  leadId: string,
  input: LogEngagementInput,
  userId: string,
  db: DbClient = prisma,
) {
  return withTx(db, async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      include: { district: { select: { leaid: true, name: true } } },
    });
    if (!lead) throw new ServiceError("Lead not found", 404);

    const { type, title } = input;
    if (!type || !title?.trim()) {
      throw new ServiceError("type and title are required", 400);
    }
    if (!(ALL_ACTIVITY_TYPES as readonly string[]).includes(type)) {
      throw new ServiceError(`Invalid activity type: ${type}`, 400);
    }
    const points = input.points ?? 0;
    if (!Number.isInteger(points)) {
      throw new ServiceError("points must be an integer", 400);
    }
    if (
      input.rating != null &&
      (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    ) {
      throw new ServiceError("rating must be an integer between 1 and 5", 400);
    }
    if (input.occurredAt && Number.isNaN(new Date(input.occurredAt).getTime())) {
      throw new ServiceError("occurredAt must be a valid date", 400);
    }

    const activity = await tx.activity.create({
      data: {
        type,
        title: title.trim(),
        notes: input.notes?.trim() || null,
        startDate: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        status: "completed",
        createdByUserId: userId,
        outcome: input.outcome?.trim() || null,
        outcomeType: input.outcomeType || null,
        rating: input.rating ?? null,
        // The lead score increment stays the source of truth for totals;
        // metadata.leadPoints records what THIS activity carried so the
        // timeline can render "+N pts" (activities have no points column).
        ...(points !== 0 ? { metadata: { leadPoints: points } } : {}),
        contacts: { create: [{ contactId: lead.contactId }] },
        districts: { create: [{ districtLeaid: lead.leaid }] },
        ...(lead.schoolNcessch
          ? { schools: { create: [{ ncessch: lead.schoolNcessch }] } }
          : {}),
      },
    });

    let updated: LeadWithRelations;
    if (points !== 0) {
      updated = await tx.lead.update({
        where: { id: lead.id },
        data: { score: { increment: points } },
        include: LEAD_INCLUDE,
      });
    } else {
      updated = await tx.lead.findUniqueOrThrow({
        where: { id: lead.id },
        include: LEAD_INCLUDE,
      });
    }

    if (input.resultingStatus && input.resultingStatus !== lead.status) {
      if (!(LEAD_STATUSES as readonly string[]).includes(input.resultingStatus)) {
        throw new ServiceError(`resultingStatus must be one of: ${LEAD_STATUSES.join(", ")}`, 400);
      }
      updated = await applyTransition(
        tx,
        lead,
        input.resultingStatus as LeadStatus,
        { reason: input.reason },
        userId,
      );
    }

    return { activity, lead: updated };
  });
}

// ---- linkOpportunity -----------------------------------------------------------

export interface LinkOpportunityInput {
  /** Link an existing open opportunity; omit to create a fresh Stage 0 opp. */
  opportunityId?: string | null;
  name?: string | null;
  amount?: number | null;
  closeDate?: string | null;
}

export async function linkOpportunity(
  leadId: string,
  input: LinkOpportunityInput,
  userId: string,
  db: DbClient = prisma,
): Promise<LeadWithRelations> {
  return withTx(db, async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      include: { district: { select: { leaid: true, name: true } } },
    });
    if (!lead) throw new ServiceError("Lead not found", 404);

    let opportunityId: string;
    let mode: "linked" | "created";
    if (input.opportunityId) {
      const opp = await tx.opportunity.findUnique({
        where: { id: input.opportunityId },
        select: { id: true, stage: true },
      });
      if (!opp) throw new ServiceError("Opportunity not found", 404);
      if (opp.stage && CLOSED_OPP_STAGES.includes(opp.stage)) {
        throw new ServiceError("Cannot link a closed opportunity", 400);
      }
      opportunityId = opp.id;
      mode = "linked";
    } else {
      const opp = await createStage0Opportunity(tx, lead, userId, input);
      opportunityId = opp.id;
      mode = "created";
    }

    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: { opportunityId },
      include: LEAD_INCLUDE,
    });
    await tx.leadEvent.create({
      data: {
        leadId: lead.id,
        kind: "opp_created",
        actorId: userId,
        payload:
          mode === "created"
            ? { opportunityId, mode, stage: LEAD_OPP_STAGE_MEETING_BOOKED }
            : { opportunityId, mode },
      },
    });
    return updated;
  });
}
