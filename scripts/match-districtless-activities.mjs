/**
 * Match district-less activities to a district using available signals.
 *
 * Two signals, in priority order:
 *   1. opp  — a linked Opportunity's district_lea_id (exact).
 *   2. geo  — point-in-polygon of the activity's geocoded address against
 *             districts.geometry (MULTIPOLYGON, SRID 4326).
 *
 * Only activities currently with NO district are considered. We require a
 * SINGLE unambiguous candidate: if opp and geo disagree, or multiple distinct
 * candidates appear, the activity is reported as a conflict and skipped.
 *
 * On match we insert the ActivityDistrict plus its derived (non-explicit)
 * ActivityState, mirroring POST /api/activities/[id]/districts. Plan auto-
 * linking is NOT done here — re-run scripts/backfill-activity-plan-links.mjs
 * afterward to attach the newly-districted activities to their plans.
 *
 * DRY-RUN BY DEFAULT (read-only). Pass --apply to write.
 *
 *   Dry run:  node --env-file=.env scripts/match-districtless-activities.mjs
 *   Apply:    node --env-file=.env scripts/match-districtless-activities.mjs --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const OPP_ONLY = process.argv.includes("--opp-only");
const log = (...a) => console.log(...a);

async function main() {
  log(`\n=== Match district-less activities  (${APPLY ? "APPLY — WILL WRITE" : "DRY RUN"}${OPP_ONLY ? ", opp-only" : ""}) ===\n`);

  // Opp-based candidates: activity -> distinct opp district leaids.
  const oppActs = await prisma.activity.findMany({
    where: { districts: { none: {} }, opportunities: { some: {} } },
    select: {
      id: true, type: true, title: true,
      opportunities: { select: { opportunity: { select: { districtLeaId: true } } } },
    },
  });
  const oppCandidate = new Map(); // activityId -> Set(leaid)
  for (const a of oppActs) {
    const s = new Set(a.opportunities.map((o) => o.opportunity?.districtLeaId).filter(Boolean));
    if (s.size) oppCandidate.set(a.id, s);
  }

  // Geo-based candidates: point-in-polygon for geocoded, district-less activities.
  // Skipped under --opp-only (geo matches conference/event VENUE districts, which
  // are usually not a real target district — see session notes).
  const geoCandidate = new Map(); // activityId -> Set(leaid)
  if (!OPP_ONLY) {
    const geoRows = await prisma.$queryRawUnsafe(`
      SELECT a.id AS "activityId", d.leaid AS leaid
      FROM activities a
      JOIN districts d
        ON ST_Contains(d.geometry, ST_SetSRID(ST_MakePoint(a.address_lng, a.address_lat), 4326))
      WHERE a.address_lat IS NOT NULL AND a.address_lng IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM activity_districts ad WHERE ad.activity_id = a.id)
    `);
    for (const r of geoRows) {
      if (!geoCandidate.has(r.activityId)) geoCandidate.set(r.activityId, new Set());
      geoCandidate.get(r.activityId).add(r.leaid);
    }
  }

  // Union the activity ids, resolve to a single district or flag a conflict.
  const allIds = new Set([...oppCandidate.keys(), ...geoCandidate.keys()]);
  const meta = await prisma.activity.findMany({
    where: { id: { in: [...allIds] } },
    select: { id: true, type: true, title: true },
  });
  const metaById = new Map(meta.map((m) => [m.id, m]));

  const matches = []; // { activityId, leaid, source }
  const conflicts = [];
  for (const id of allIds) {
    const opp = oppCandidate.get(id) || new Set();
    const geo = geoCandidate.get(id) || new Set();
    const union = new Set([...opp, ...geo]);
    let leaid = null, source = null;
    if (union.size === 1) {
      leaid = [...union][0];
      source = opp.size && geo.size ? "opp+geo" : opp.size ? "opp" : "geo";
    } else if (opp.size === 1) {
      // opp is the authoritative signal when geo adds noise/disagreement
      leaid = [...opp][0];
      source = "opp(over geo)";
    } else {
      conflicts.push({ id, opp: [...opp], geo: [...geo] });
      continue;
    }
    matches.push({ activityId: id, leaid, source });
  }

  // Resolve district + state names for display / state derivation.
  const leaids = [...new Set(matches.map((m) => m.leaid))];
  const districts = await prisma.district.findMany({
    where: { leaid: { in: leaids } },
    select: { leaid: true, name: true, stateFips: true },
  });
  const distById = new Map(districts.map((d) => [d.leaid, d]));

  log(`Matched activities: ${matches.length}   (conflicts skipped: ${conflicts.length})\n`);
  for (const m of matches) {
    const a = metaById.get(m.activityId);
    const d = distById.get(m.leaid);
    log(`  [${m.source.padEnd(13)}] ${(a?.type || "?").padEnd(18)} "${(a?.title || "").slice(0, 40)}"  ->  ${d?.name || "?"} (${m.leaid})`);
  }
  if (conflicts.length) {
    log(`\nConflicts (multiple candidate districts — NOT matched):`);
    for (const c of conflicts) {
      const a = metaById.get(c.id);
      log(`  ${(a?.type || "?").padEnd(18)} "${(a?.title || "").slice(0, 40)}"  opp=[${c.opp}] geo=[${c.geo}]`);
    }
  }

  if (!APPLY) {
    log(`\nDry run complete — no rows written. Re-run with --apply to write.`);
    return;
  }

  // Apply: insert ActivityDistrict + derived (non-explicit) ActivityState.
  let dWritten = 0, sWritten = 0;
  for (const m of matches) {
    const d = distById.get(m.leaid);
    const r = await prisma.activityDistrict.createMany({
      data: [{ activityId: m.activityId, districtLeaid: m.leaid, warningDismissed: false, position: 0 }],
      skipDuplicates: true,
    });
    dWritten += r.count;
    if (d?.stateFips) {
      const sr = await prisma.activityState.createMany({
        data: [{ activityId: m.activityId, stateFips: d.stateFips, isExplicit: false }],
        skipDuplicates: true,
      });
      sWritten += sr.count;
    }
  }
  log(`\nDone. Inserted ${dWritten} activity↔district links and ${sWritten} derived states. ✅`);
  log(`Next: re-run scripts/backfill-activity-plan-links.mjs --apply to link these to plans.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
