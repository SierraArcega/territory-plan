/**
 * News matcher recall harness.
 *
 * Re-runs `matchArticleKeyword` over a sample of recent articles and reports
 * how many would get linked to ≥1 district under each variant. Used to quantify
 * proposed recall improvements (state hints, publisher map, etc.) before
 * shipping them to the live matcher.
 *
 * Usage:
 *   npx tsx scripts/eval-news-matcher.ts                   # default 2000 article sample
 *   SAMPLE=500 npx tsx scripts/eval-news-matcher.ts        # smaller sample (faster)
 *   DAYS=90 npx tsx scripts/eval-news-matcher.ts           # wider time window
 *
 * Variants currently measured:
 *   • baseline — extractStates(title+description) only (current production behavior)
 *
 * Future variants (will be added in subsequent commits):
 *   • +H2: source-leaid → state hint
 *   • +H1: publisher → state map
 */
import "dotenv/config";
import prisma from "@/lib/prisma";
import { extractStates } from "@/features/news/lib/extract-states";
import {
  matchArticleKeyword,
  type DistrictCandidate,
  type SchoolCandidate,
  type ContactCandidate,
} from "@/features/news/lib/matcher-keyword";

const SAMPLE_SIZE = parseInt(process.env.SAMPLE ?? "2000", 10);
const DAYS = parseInt(process.env.DAYS ?? "30", 10);

interface Variant {
  name: string;
  hits: number;
  newHits: string[];   // article ids the baseline missed but this caught
  lostHits: string[];  // article ids baseline caught but this missed (regression sentinel)
}

async function main() {
  console.log(`[eval] sample=${SAMPLE_SIZE} window=${DAYS}d`);

  // Pull sample of recent matched articles. We re-run the matcher in-process
  // and compare its output to what's stored — so we need the article rows plus
  // their existing district links (to recover the source-confidence leaid for
  // future H2 variant).
  const articles = await prisma.newsArticle.findMany({
    where: {
      matchedAt: { not: null },
      publishedAt: { gte: new Date(Date.now() - DAYS * 24 * 3600 * 1000) },
    },
    select: {
      id: true,
      title: true,
      description: true,
      source: true,
      feedSource: true,
      stateAbbrevs: true,
      districts: { select: { leaid: true, confidence: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: SAMPLE_SIZE,
  });
  console.log(`[eval] loaded ${articles.length} articles`);

  // Load every district so the matcher has full state-scoped candidates.
  // 13k rows is fine to hold in memory.
  const allDistricts = await prisma.district.findMany({
    select: {
      leaid: true,
      name: true,
      stateAbbrev: true,
      cityLocation: true,
      countyName: true,
      accountName: true,
    },
  });
  const districtsByState = new Map<string, DistrictCandidate[]>();
  for (const d of allDistricts) {
    if (!d.stateAbbrev) continue;
    const arr = districtsByState.get(d.stateAbbrev) ?? [];
    arr.push({
      leaid: d.leaid,
      name: d.name,
      stateAbbrev: d.stateAbbrev,
      cityLocation: d.cityLocation,
      countyName: d.countyName,
      accountName: d.accountName,
    });
    districtsByState.set(d.stateAbbrev, arr);
  }
  console.log(`[eval] loaded districts for ${districtsByState.size} states`);

  // Empty maps for schools/contacts — this harness measures district recall only.
  const schoolsByLeaid = new Map<string, SchoolCandidate[]>();
  const contactsByLeaid = new Map<string, ContactCandidate[]>();

  // Run the baseline variant: extract states from text only.
  const baseline: Variant = { name: "baseline", hits: 0, newHits: [], lostHits: [] };
  const newMatchExamples: Array<{
    id: string;
    title: string;
    states: string[];
    leaids: string[];
  }> = [];

  for (const a of articles) {
    const text = [a.title, a.description ?? ""].join(" ");
    const states = extractStates(text);
    const result = matchArticleKeyword({
      articleText: text,
      stateAbbrevs: states,
      districtsByState,
      schoolsByLeaid,
      schoolsByState: undefined,
      contactsByLeaid,
    });

    const hit = result.confirmedDistricts.length > 0;
    if (hit) {
      baseline.hits++;
      if (newMatchExamples.length < 10) {
        newMatchExamples.push({
          id: a.id,
          title: a.title,
          states,
          leaids: result.confirmedDistricts.map((d) => d.leaid),
        });
      }
    }
  }

  console.log("");
  console.log(`=== Baseline ===`);
  console.log(
    `  ${baseline.hits} / ${articles.length} (${((baseline.hits / articles.length) * 100).toFixed(1)}%) ` +
      `articles matched ≥1 district via keyword passes`
  );
  console.log("");
  console.log(`Sample baseline matches:`);
  for (const ex of newMatchExamples) {
    console.log(`  [${ex.states.join(",")}] ${ex.leaids.join(",")} — ${ex.title.slice(0, 80)}`);
  }

  // Cross-check: how many of the sampled articles have a district link in the
  // DB right now (any confidence)? Source-confidence is dominant in production;
  // baseline will be far below this number.
  let dbAnyHits = 0;
  let dbHighOrLlmHits = 0;
  for (const a of articles) {
    if (a.districts.length > 0) dbAnyHits++;
    if (a.districts.some((d) => d.confidence === "high" || d.confidence === "llm")) {
      dbHighOrLlmHits++;
    }
  }
  console.log("");
  console.log(`=== DB cross-check (same sample) ===`);
  console.log(
    `  ${dbAnyHits} / ${articles.length} (${((dbAnyHits / articles.length) * 100).toFixed(1)}%) ` +
      `have any district link (incl. source-confidence)`
  );
  console.log(
    `  ${dbHighOrLlmHits} / ${articles.length} (${((dbHighOrLlmHits / articles.length) * 100).toFixed(1)}%) ` +
      `have a high/llm-confidence link (this is what the keyword/LLM pipeline produced)`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
