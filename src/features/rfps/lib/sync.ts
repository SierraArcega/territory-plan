import prisma from "@/lib/prisma";
import { fetchOpportunities } from "./highergov-client";
import { resolveAgency, type ResolveResult } from "./district-resolver";
import { normalizeOpportunity, type NormalizedRfp } from "./normalize";
import type { HigherGovOpportunity } from "./types";

const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000;
const COLD_START_LOOKBACK_DAYS = 90;
const POSTED_RECENCY_DAYS = 365;
const SOURCE = "highergov";

export interface SyncSummary {
  runId: number;
  status: "ok" | "error";
  recordsSeen: number;
  recordsNew: number;
  recordsUpdated: number;
  recordsResolved: number;
  recordsUnresolved: number;
  recordsResolvedByOverride: number;
  recordsResolvedByName: number;
  recordsSkippedStale: number;
  watermark: Date;
  error?: string;
}

async function orphanSweep(): Promise<void> {
  await prisma.rfpIngestRun.updateMany({
    where: {
      source: SOURCE,
      status: "running",
      startedAt: { lt: new Date(Date.now() - ORPHAN_THRESHOLD_MS) },
    },
    data: { status: "error", error: "orphaned (>10min running)", finishedAt: new Date() },
  });
}

async function computeWatermark(): Promise<Date> {
  const lastOk = await prisma.rfpIngestRun.findFirst({
    where: { source: SOURCE, status: "ok" },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true },
  });
  if (lastOk?.finishedAt) return lastOk.finishedAt;
  return new Date(Date.now() - COLD_START_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
}

function rfpUpsertArgs(n: NormalizedRfp, leaid: string | null) {
  const now = new Date();
  const data = {
    versionKey: n.versionKey,
    source: SOURCE,
    title: n.title,
    solicitationNumber: n.solicitationNumber,
    oppType: n.oppType,
    description: n.description,
    aiSummary: n.aiSummary,
    agencyKey: n.agencyKey,
    agencyName: n.agencyName,
    agencyPath: n.agencyPath,
    stateAbbrev: n.stateAbbrev,
    stateFips: n.stateFips,
    popCity: n.popCity,
    popZip: n.popZip,
    leaid,
    naicsCode: n.naicsCode,
    pscCode: n.pscCode,
    setAside: n.setAside,
    valueLow: n.valueLow,
    valueHigh: n.valueHigh,
    primaryContactName: n.primaryContactName,
    primaryContactEmail: n.primaryContactEmail,
    primaryContactPhone: n.primaryContactPhone,
    postedDate: n.postedDate,
    dueDate: n.dueDate,
    capturedDate: n.capturedDate,
    highergovUrl: n.highergovUrl,
    sourceUrl: n.sourceUrl,
    higherGovSourceType: n.higherGovSourceType,
    rawPayload: n.rawPayload as object,
  };
  return {
    where: { externalId: n.externalId },
    create: { externalId: n.externalId, ...data, firstSeenAt: now, lastSeenAt: now },
    update: { ...data, lastSeenAt: now },
  };
}

export async function syncRfps(): Promise<SyncSummary> {
  await orphanSweep();
  const watermark = await computeWatermark();
  const run = await prisma.rfpIngestRun.create({
    data: { source: SOURCE, status: "running", watermark },
  });

  const counters = {
    recordsSeen: 0, recordsNew: 0, recordsUpdated: 0,
    recordsResolved: 0, recordsUnresolved: 0,
    recordsResolvedByOverride: 0, recordsResolvedByName: 0,
    recordsSkippedStale: 0,
  };

  const agencyCache = new Map<number, ResolveResult>();
  const postedSince = new Date(Date.now() - POSTED_RECENCY_DAYS * 24 * 60 * 60 * 1000);

  try {
    const buffer: HigherGovOpportunity[] = [];
    for await (const r of fetchOpportunities({ since: watermark, postedSince })) buffer.push(r);

    const uniqueAgencies = new Map<number, { name: string; state: string }>();
    for (const r of buffer) {
      if (!uniqueAgencies.has(r.agency.agency_key)) {
        uniqueAgencies.set(r.agency.agency_key, { name: r.agency.agency_name, state: r.pop_state });
      }
    }
    for (const [key, { name, state }] of uniqueAgencies) {
      agencyCache.set(key, await resolveAgency({ agencyKey: key, agencyName: name, stateAbbrev: state }));
    }

    for (const raw of buffer) {
      counters.recordsSeen++;
      try {
        const normalized = normalizeOpportunity(raw);
        if (!normalized.postedDate || normalized.postedDate < postedSince) {
          counters.recordsSkippedStale++;
          continue;
        }
        const resolution = agencyCache.get(raw.agency.agency_key) ?? { leaid: null, kind: "unresolved" as const };
        const result = await prisma.rfp.upsert(rfpUpsertArgs(normalized, resolution.leaid));
        if (result.firstSeenAt && result.lastSeenAt &&
            result.firstSeenAt.getTime() === result.lastSeenAt.getTime()) {
          counters.recordsNew++;
        } else {
          counters.recordsUpdated++;
        }
        if (resolution.leaid) {
          counters.recordsResolved++;
          if (resolution.kind === "override_district") counters.recordsResolvedByOverride++;
          else if (resolution.kind === "name_match")  counters.recordsResolvedByName++;
        } else {
          counters.recordsUnresolved++;
        }
      } catch (err) {
        console.error(JSON.stringify({
          event: "rfp_record_error", opp_key: raw.opp_key, error: String(err).slice(0, 500),
        }));
      }
    }

    await prisma.rfpIngestRun.update({
      where: { id: run.id },
      data: { status: "ok", finishedAt: new Date(), ...counters },
    });

    console.log(JSON.stringify({
      event: "rfp_cron_summary", runId: run.id, watermark: watermark.toISOString(), ...counters,
    }));

    return { runId: run.id, status: "ok", watermark, ...counters };
  } catch (err) {
    const errStr = String(err).slice(0, 2000);
    await prisma.rfpIngestRun.update({
      where: { id: run.id },
      data: { status: "error", finishedAt: new Date(), error: errStr, ...counters },
    });
    throw err;
  }
}
