/**
 * Suggest a district for "bare" district-less activities by matching the
 * activity TITLE against real district names, scoped to the REP's operating
 * states (derived from districts on the rep's existing activities).
 *
 * READ-ONLY. Prints ranked suggestions for human review — writes nothing.
 * The point is "name + rep is usually enough to point us in the right
 * direction"; a human confirms before anything is written.
 *
 *   node --env-file=.env scripts/suggest-districts-from-titles.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const excludeArg = process.argv.find((a) => a.startsWith("--exclude="));
const EXCLUDE = new Set(excludeArg ? excludeArg.slice("--exclude=".length).split(",").map(Number) : []);

// Boilerplate stripped from titles before matching.
const NOISE = [
  "fullmind", "elevate k-12", "elevate k12", "elevate", "k-12",
  "discovery call", "program check-in", "check-in", "check in", "checkin",
  "monthly", "weekly", "meeting", "onsite visit", "site visit", "drop in",
  "drop-in", "touchbase", "touch base", "connect", "follow up", "follow-up",
  "follow up meeting", "planning", "program review", "program discussion",
  "pipeline review", "intro", "ceo intro", "partnership", "partner",
  "conference", "summit", "dinner", "lunch", "reminder", "no meeting",
  "implementation call", "standup", "huddle", "sow", "sy26-27", "sy25/26",
  "26/27", "25/26", "in-person", "virtual", "staffing", "win back", "winback",
];
// Generic words removed from district names to get the distinctive core.
const GENERIC = new Set([
  "school", "schools", "district", "districts", "county", "city", "unified",
  "union", "elementary", "high", "public", "community", "consolidated",
  "independent", "central", "area", "township", "township", "isd", "usd",
  "csd", "ufsd", "sd", "uhsd", "the", "of", "no", "number", "joint",
]);
const NUMWORD = { "1": "one", "2": "two", "3": "three", "4": "four", "5": "five" };

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

function cleanTitle(title) {
  let t = " " + norm(title) + " ";
  for (const n of NOISE) t = t.replaceAll(" " + n + " ", " ");
  return t.replace(/\s+/g, " ").trim();
}

// Distinctive core tokens of a district name (generic words dropped).
function coreTokens(name) {
  return norm(name)
    .split(" ")
    .map((w) => NUMWORD[w] || w)
    .filter((w) => w.length > 1 && !GENERIC.has(w) && !/^\d+$/.test(w));
}

async function main() {
  const SYSTEM = new Set(["system_migration", "contact_enrichment", "mixmax_campaign", "email_campaign", "email"]);

  // Rep operating states (fips -> weight) from districts on their activities.
  const adRows = await prisma.$queryRawUnsafe(`
    SELECT a.created_by_user_id AS uid, d.state_fips AS fips, COUNT(*)::int AS n
    FROM activity_districts ad
    JOIN activities a ON a.id = ad.activity_id
    JOIN districts d ON d.leaid = ad.district_leaid
    WHERE a.created_by_user_id IS NOT NULL
    GROUP BY 1,2`);
  const repStates = new Map(); // uid -> Set(fips)
  for (const r of adRows) {
    if (!repStates.has(r.uid)) repStates.set(r.uid, new Set());
    repStates.get(r.uid).add(r.fips);
  }

  // All districts grouped by state, with precomputed core tokens.
  const districts = await prisma.district.findMany({ select: { leaid: true, name: true, stateFips: true } });
  const byState = new Map(); // fips -> [{leaid,name,core}]
  for (const d of districts) {
    if (!byState.has(d.stateFips)) byState.set(d.stateFips, []);
    byState.get(d.stateFips).push({ ...d, core: coreTokens(d.name) });
  }

  const users = await prisma.userProfile.findMany({ select: { id: true, fullName: true } });
  const repName = new Map(users.map((u) => [u.id, u.fullName || "?"]));

  // Bare, real, district-less activities.
  const acts = await prisma.activity.findMany({
    where: { districts: { none: {} }, contacts: { none: {} }, opportunities: { none: {} }, addressLat: null },
    select: { id: true, type: true, title: true, createdByUserId: true },
  });
  const real = acts.filter((a) => !SYSTEM.has(a.type));

  // Event-type activities name a venue/event, not a target district — demote
  // (same venue-noise lesson as the geocode pass).
  const EVENT = new Set(["conference", "conference_sponsor", "meal_reception", "charity_event", "happy_hour"]);
  const word = (haystack, w) => new RegExp(`\\b${w}\\b`).test(haystack);

  const suggestions = [];
  const noMatch = [];
  for (const a of real) {
    const ct = cleanTitle(a.title);
    const states = repStates.get(a.createdByUserId) || new Set();
    const repTokens = new Set(norm(repName.get(a.createdByUserId)).split(" ")); // skip rep's own name
    let best = null;
    for (const fips of states) {
      for (const d of byState.get(fips) || []) {
        if (!d.core.length) continue;
        // Whole-word hits only; never match on the rep's own name tokens.
        const hit = d.core.filter((w) => word(ct, w) && !repTokens.has(w));
        if (!hit.length) continue;
        const longest = Math.max(...hit.map((w) => w.length));
        const coversAll = hit.length === d.core.length;
        // Confidence: multi-token match, or a long unique single token.
        let conf = null;
        if (hit.length >= 2 && coversAll) conf = "high";
        else if (hit.length >= 2) conf = "med";
        else if (longest >= 6 && coversAll) conf = "high";
        else if (longest >= 5) conf = "med";
        else continue; // single short token → too weak
        if (EVENT.has(a.type)) conf = "low"; // venue noise
        const rank = { high: 3, med: 2, low: 1 }[conf];
        const score = rank * 100 + hit.join("").length + (coversAll ? 5 : 0);
        if (!best || score > best.score) best = { ...d, fips, hit, conf, score };
      }
    }
    if (best) suggestions.push({ a, best });
    else noMatch.push(a);
  }
  suggestions.sort((x, y) => y.best.score - x.best.score);

  // Numbered picklist of high+med candidates (low/no-match printed separately).
  const pick = suggestions.filter((s) => s.best.conf === "high" || s.best.conf === "med");
  console.log(`\n=== PICKLIST: high+med candidates (${pick.length}) — reference by # ===`);
  pick.forEach(({ a, best }, i) => {
    const n = String(i + 1).padStart(3);
    const rep = (repName.get(a.createdByUserId) || "?").slice(0, 14).padEnd(14);
    console.log(`${n} ${best.conf.toUpperCase().padEnd(4)} ${rep} ${a.id.slice(0, 8)} "${(a.title || "").slice(0, 44)}"  ->  ${best.name} (${best.leaid})`);
  });
  console.log(`\n=== LOW / NO match (not in picklist) ===`);
  for (const { a, best } of suggestions.filter((s) => s.best.conf === "low")) {
    console.log(`  LOW  [${a.type}] "${(a.title || "").slice(0, 40)}" -> ${best.name} (${best.leaid})`);
  }
  for (const a of noMatch) console.log(`  NONE [${a.type}] ${a.title}`);

  // Apply selected picks (by 1-based picklist index), skipping --exclude=… ones.
  if (APPLY) {
    const chosen = pick.filter((_, i) => !EXCLUDE.has(i + 1));
    console.log(`\n=== APPLYING ${chosen.length} picks (excluded: ${[...EXCLUDE].sort((a, b) => a - b).join(",") || "none"}) ===`);
    // Resolve state fips for derived ActivityState.
    const leaids = [...new Set(chosen.map((c) => c.best.leaid))];
    const dmeta = await prisma.district.findMany({ where: { leaid: { in: leaids } }, select: { leaid: true, stateFips: true } });
    const fipsBy = new Map(dmeta.map((d) => [d.leaid, d.stateFips]));
    let dW = 0, sW = 0;
    for (const { a, best } of chosen) {
      const r = await prisma.activityDistrict.createMany({
        data: [{ activityId: a.id, districtLeaid: best.leaid, warningDismissed: false, position: 0 }],
        skipDuplicates: true,
      });
      dW += r.count;
      const fips = fipsBy.get(best.leaid);
      if (fips) {
        const sr = await prisma.activityState.createMany({
          data: [{ activityId: a.id, stateFips: fips, isExplicit: false }],
          skipDuplicates: true,
        });
        sW += sr.count;
      }
    }
    console.log(`Inserted ${dW} activity↔district links and ${sW} derived states. ✅`);
    console.log(`Next: re-run scripts/backfill-activity-plan-links.mjs --apply to link these to plans.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
