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
 *   • +H2 — adds source-leaid → state hint. For google_news_district / manual_refresh
 *           articles, the ingest path stamps a `news_article_districts` row at
 *           confidence='source' pointing at the queried district. From that leaid
 *           we know the state, so we feed it into the matcher's stateAbbrevs.
 *
 * Future variants (will be added in subsequent commits):
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
  const stateByLeaid = new Map<string, string>();
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
    stateByLeaid.set(d.leaid, d.stateAbbrev);
  }
  console.log(`[eval] loaded districts for ${districtsByState.size} states`);

  // Empty maps for schools/contacts — this harness measures district recall only.
  const schoolsByLeaid = new Map<string, SchoolCandidate[]>();
  const contactsByLeaid = new Map<string, ContactCandidate[]>();

  // Run baseline + H2 variants side-by-side per article so we can identify
  // articles newly caught (or newly missed) under H2.
  const baseline: Variant = { name: "baseline", hits: 0, newHits: [], lostHits: [] };
  const h2: Variant = { name: "+H2 (source-leaid hint)", hits: 0, newHits: [], lostHits: [] };
  const h2NewExamples: Array<{ title: string; sourceLeaid: string; addedState: string; leaids: string[] }> = [];
  const h2LostExamples: Array<{ title: string; baselineStates: string[]; baselineLeaids: string[] }> = [];

  let articlesWithSourceLeaid = 0;
  let articlesWhereHintAddsNewState = 0;

  for (const a of articles) {
    const text = [a.title, a.description ?? ""].join(" ");
    const baselineStates = extractStates(text);

    const baselineResult = matchArticleKeyword({
      articleText: text,
      stateAbbrevs: baselineStates,
      districtsByState,
      schoolsByLeaid,
      schoolsByState: undefined,
      contactsByLeaid,
    });
    const baselineHit = baselineResult.confirmedDistricts.length > 0;
    if (baselineHit) baseline.hits++;

    // H2: add the state of the source-confidence leaid (if any) to stateAbbrevs.
    // Production stamps that link in src/features/news/lib/ingest.ts:65 when an
    // article was discovered via a district-scoped Google News query.
    const sourceLink = a.districts.find((d) => d.confidence === "source");
    const sourceLeaid = sourceLink?.leaid;
    let hintedState: string | undefined;
    if (sourceLeaid) {
      articlesWithSourceLeaid++;
      const st = stateByLeaid.get(sourceLeaid);
      if (st && !baselineStates.includes(st)) {
        hintedState = st;
        articlesWhereHintAddsNewState++;
      }
    }
    const h2States = hintedState ? [...baselineStates, hintedState] : baselineStates;
    const h2Result = matchArticleKeyword({
      articleText: text,
      stateAbbrevs: h2States,
      districtsByState,
      schoolsByLeaid,
      schoolsByState: undefined,
      contactsByLeaid,
    });
    const h2Hit = h2Result.confirmedDistricts.length > 0;
    if (h2Hit) h2.hits++;

    if (h2Hit && !baselineHit && hintedState) {
      h2.newHits.push(a.id);
      if (h2NewExamples.length < 15) {
        h2NewExamples.push({
          title: a.title,
          sourceLeaid: sourceLeaid!,
          addedState: hintedState,
          leaids: h2Result.confirmedDistricts.map((d) => d.leaid),
        });
      }
    }
    if (!h2Hit && baselineHit) {
      h2.lostHits.push(a.id);
      if (h2LostExamples.length < 5) {
        h2LostExamples.push({
          title: a.title,
          baselineStates,
          baselineLeaids: baselineResult.confirmedDistricts.map((d) => d.leaid),
        });
      }
    }
  }

  const pct = (n: number) => `${((n / articles.length) * 100).toFixed(1)}%`;

  console.log("");
  console.log(`=== Coverage ===`);
  console.log(`  Baseline:                    ${baseline.hits} / ${articles.length}  (${pct(baseline.hits)})`);
  console.log(`  +H2 (source-leaid hint):     ${h2.hits} / ${articles.length}  (${pct(h2.hits)})  +${h2.hits - baseline.hits}`);
  console.log("");
  console.log(`=== H2 hint stats ===`);
  console.log(`  Articles with a source-leaid link: ${articlesWithSourceLeaid} (${pct(articlesWithSourceLeaid)})`);
  console.log(`  Of those, source state was NOT already in baseline's states: ${articlesWhereHintAddsNewState}`);
  console.log(`  Newly matched (only with H2): ${h2.newHits.length}`);
  console.log(`  Newly missed (regressions vs baseline): ${h2.lostHits.length}`);
  console.log("");
  console.log(`Sample articles newly matched under H2:`);
  for (const ex of h2NewExamples) {
    console.log(
      `  +[${ex.addedState}] (queried-for ${ex.sourceLeaid}) → matched ${ex.leaids.join(",")}\n` +
        `      ${ex.title.slice(0, 100)}`
    );
  }
  if (h2LostExamples.length > 0) {
    console.log("");
    console.log(`Sample regressions (H2 missed something baseline caught):`);
    for (const ex of h2LostExamples) {
      console.log(`  baseline=[${ex.baselineStates.join(",")}]→${ex.baselineLeaids.join(",")} — ${ex.title.slice(0, 100)}`);
    }
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
