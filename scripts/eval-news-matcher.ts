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
 *   • +H1+H2 — also adds a publisher → state map mined from the existing corpus:
 *              for any publisher whose source-confidence links concentrate ≥70%
 *              in one state (≥10 articles), we trust the publisher's state on
 *              future articles. Helps Layer 2 articles (broad Google News
 *              queries) where the source-leaid path doesn't fire.
 */
import "dotenv/config";
import PQueue from "p-queue";
import prisma from "@/lib/prisma";
import { extractStates } from "@/features/news/lib/extract-states";
import {
  matchArticleKeyword,
  type DistrictCandidate,
  type SchoolCandidate,
  type ContactCandidate,
} from "@/features/news/lib/matcher-keyword";
import { matchArticleLLM } from "@/features/news/lib/matcher-llm";

const SAMPLE_SIZE = parseInt(process.env.SAMPLE ?? "2000", 10);
const DAYS = parseInt(process.env.DAYS ?? "30", 10);
/** Set LLM=1 to validate new matches via matcher-llm (Haiku). ~$0.001/match. */
const RUN_LLM = process.env.LLM === "1";
const LLM_SAMPLE = parseInt(process.env.LLM_SAMPLE ?? "100", 10);
const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY ?? "5", 10);

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
  const districtByLeaid = new Map<string, DistrictCandidate>();
  const stateByLeaid = new Map<string, string>();
  for (const d of allDistricts) {
    if (!d.stateAbbrev) continue;
    const cand: DistrictCandidate = {
      leaid: d.leaid,
      name: d.name,
      stateAbbrev: d.stateAbbrev,
      cityLocation: d.cityLocation,
      countyName: d.countyName,
      accountName: d.accountName,
    };
    const arr = districtsByState.get(d.stateAbbrev) ?? [];
    arr.push(cand);
    districtsByState.set(d.stateAbbrev, arr);
    districtByLeaid.set(d.leaid, cand);
    stateByLeaid.set(d.leaid, d.stateAbbrev);
  }
  console.log(`[eval] loaded districts for ${districtsByState.size} states`);

  const newPairs: Array<{
    title: string;
    description: string | null;
    leaid: string;
    via: "H2" | "H1";
  }> = [];

  // Empty maps for schools/contacts — this harness measures district recall only.
  const schoolsByLeaid = new Map<string, SchoolCandidate[]>();
  const contactsByLeaid = new Map<string, ContactCandidate[]>();

  // H1: build publisher → state map from existing source-confidence links.
  // A publisher whose links concentrate ≥70% in one state (≥10 articles) is
  // treated as a state-local publisher. Slight training leakage from the 2000-
  // article sample is negligible against the ~200K-link aggregation, so we
  // don't bother filtering it out.
  const publisherStateRaw = await prisma.$queryRaw<
    Array<{ source: string; state_abbrev: string }>
  >`
    WITH ps AS (
      SELECT na.source, d.state_abbrev, COUNT(*)::bigint AS n
      FROM news_articles na
      JOIN news_article_districts nad ON nad.article_id = na.id
      JOIN districts d ON d.leaid = nad.leaid
      WHERE d.state_abbrev IS NOT NULL
      GROUP BY na.source, d.state_abbrev
    ),
    tot AS (SELECT source, SUM(n)::bigint AS total FROM ps GROUP BY source),
    ranked AS (
      SELECT ps.source, ps.state_abbrev, ps.n, tot.total,
        ROW_NUMBER() OVER (PARTITION BY ps.source ORDER BY ps.n DESC) AS rk
      FROM ps JOIN tot ON tot.source = ps.source
    )
    SELECT source, state_abbrev
    FROM ranked
    WHERE rk = 1 AND total >= 10 AND (n::numeric / total) >= 0.7
  `;
  const publisherToState = new Map<string, string>();
  for (const r of publisherStateRaw) publisherToState.set(r.source, r.state_abbrev);
  console.log(`[eval] built publisher→state map with ${publisherToState.size} entries`);

  // Run baseline + H2 + H1+H2 variants side-by-side so we can identify
  // articles newly caught (or newly missed) under each.
  const baseline: Variant = { name: "baseline", hits: 0, newHits: [], lostHits: [] };
  const h2: Variant = { name: "+H2 (source-leaid hint)", hits: 0, newHits: [], lostHits: [] };
  const h12: Variant = { name: "+H1+H2 (publisher map)", hits: 0, newHits: [], lostHits: [] };
  const h2NewExamples: Array<{ title: string; sourceLeaid: string; addedState: string; leaids: string[] }> = [];
  const h2LostExamples: Array<{ title: string; baselineStates: string[]; baselineLeaids: string[] }> = [];
  const h1NewExamples: Array<{ title: string; publisher: string; addedState: string; leaids: string[] }> = [];
  const h1LostExamples: Array<{ title: string; reason: string }> = [];

  let articlesWithSourceLeaid = 0;
  let articlesWhereHintAddsNewState = 0;
  let articlesWithPublisherMatch = 0;
  let articlesWherePublisherAddsNewState = 0;

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
      const baselineLeaids = new Set(baselineResult.confirmedDistricts.map((d) => d.leaid));
      for (const m of h2Result.confirmedDistricts) {
        if (!baselineLeaids.has(m.leaid)) {
          newPairs.push({ title: a.title, description: a.description, leaid: m.leaid, via: "H2" });
        }
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

    // H1+H2: layer publisher state hint on top of H2.
    let publisherState: string | undefined;
    const fromPublisher = publisherToState.get(a.source);
    if (fromPublisher) articlesWithPublisherMatch++;
    const h12StatesSet = new Set(h2States);
    if (fromPublisher && !h12StatesSet.has(fromPublisher)) {
      publisherState = fromPublisher;
      articlesWherePublisherAddsNewState++;
      h12StatesSet.add(fromPublisher);
    }
    const h12States = [...h12StatesSet];
    const h12Result = matchArticleKeyword({
      articleText: text,
      stateAbbrevs: h12States,
      districtsByState,
      schoolsByLeaid,
      schoolsByState: undefined,
      contactsByLeaid,
    });
    const h12Hit = h12Result.confirmedDistricts.length > 0;
    if (h12Hit) h12.hits++;

    if (h12Hit && !h2Hit && publisherState) {
      h12.newHits.push(a.id);
      if (h1NewExamples.length < 15) {
        h1NewExamples.push({
          title: a.title,
          publisher: a.source,
          addedState: publisherState,
          leaids: h12Result.confirmedDistricts.map((d) => d.leaid),
        });
      }
      const h2Leaids = new Set(h2Result.confirmedDistricts.map((d) => d.leaid));
      for (const m of h12Result.confirmedDistricts) {
        if (!h2Leaids.has(m.leaid)) {
          newPairs.push({ title: a.title, description: a.description, leaid: m.leaid, via: "H1" });
        }
      }
    }
    if (!h12Hit && h2Hit) {
      h12.lostHits.push(a.id);
      if (h1LostExamples.length < 5) {
        h1LostExamples.push({
          title: a.title,
          reason: `H2 had it via [${h2States.join(",")}], H1 added [${publisherState ?? "(none)"}]`,
        });
      }
    }
  }

  const pct = (n: number) => `${((n / articles.length) * 100).toFixed(1)}%`;

  console.log("");
  console.log(`=== Coverage ===`);
  console.log(`  Baseline:                    ${baseline.hits} / ${articles.length}  (${pct(baseline.hits)})`);
  console.log(`  +H2 (source-leaid hint):     ${h2.hits} / ${articles.length}  (${pct(h2.hits)})  +${h2.hits - baseline.hits}`);
  console.log(`  +H1+H2 (publisher map):      ${h12.hits} / ${articles.length}  (${pct(h12.hits)})  +${h12.hits - h2.hits} over H2`);
  console.log("");
  console.log(`=== H2 hint stats ===`);
  console.log(`  Articles with a source-leaid link: ${articlesWithSourceLeaid} (${pct(articlesWithSourceLeaid)})`);
  console.log(`  Of those, source state was NOT already in baseline's states: ${articlesWhereHintAddsNewState}`);
  console.log(`  Newly matched (only with H2): ${h2.newHits.length}`);
  console.log(`  Newly missed (regressions vs baseline): ${h2.lostHits.length}`);
  console.log("");
  console.log(`=== H1 hint stats ===`);
  console.log(`  Articles whose publisher is in the map: ${articlesWithPublisherMatch} (${pct(articlesWithPublisherMatch)})`);
  console.log(`  Of those, publisher state was NOT already in H2's states: ${articlesWherePublisherAddsNewState}`);
  console.log(`  Newly matched (only with H1+H2 vs H2): ${h12.newHits.length}`);
  console.log(`  Newly missed (regressions vs H2): ${h12.lostHits.length}`);
  console.log("");
  console.log(`Sample articles newly matched under H2 (over baseline):`);
  for (const ex of h2NewExamples) {
    console.log(
      `  +[${ex.addedState}] (queried-for ${ex.sourceLeaid}) → matched ${ex.leaids.join(",")}\n` +
        `      ${ex.title.slice(0, 100)}`
    );
  }
  console.log("");
  console.log(`Sample articles newly matched under H1 (over H2):`);
  for (const ex of h1NewExamples) {
    console.log(
      `  +[${ex.addedState}] (publisher "${ex.publisher}") → matched ${ex.leaids.join(",")}\n` +
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
  if (h1LostExamples.length > 0) {
    console.log("");
    console.log(`Sample regressions (H1 missed something H2 caught):`);
    for (const ex of h1LostExamples) {
      console.log(`  ${ex.reason} — ${ex.title.slice(0, 100)}`);
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

  if (RUN_LLM) {
    await validateNewMatchesViaLlm(newPairs, districtByLeaid);
  } else {
    console.log("");
    console.log(`Total new (article, leaid) pairs from H1+H2: ${newPairs.length}`);
    console.log(`(skip LLM precision check — set LLM=1 to run, ~$0.001/pair)`);
  }
}

async function validateNewMatchesViaLlm(
  pairs: Array<{ title: string; description: string | null; leaid: string; via: "H2" | "H1" }>,
  districtByLeaid: Map<string, DistrictCandidate>
) {
  const sample = [...pairs].sort(() => Math.random() - 0.5).slice(0, LLM_SAMPLE);
  console.log("");
  console.log(`=== LLM precision check ===`);
  console.log(`  Validating ${sample.length} of ${pairs.length} new (article, leaid) pairs (concurrency ${LLM_CONCURRENCY})`);

  const results: Array<{ via: string; confirmed: boolean; title: string; districtName: string; error?: string }> = [];
  const queue = new PQueue({ concurrency: LLM_CONCURRENCY });
  for (const p of sample) {
    queue.add(async () => {
      const cand = districtByLeaid.get(p.leaid);
      if (!cand) return;
      try {
        const r = await matchArticleLLM(
          { title: p.title, description: p.description },
          { districts: [cand], schools: [], contacts: [] }
        );
        const confirmed = r.confirmedDistricts.some((d) => d.leaid === p.leaid);
        results.push({ via: p.via, confirmed, title: p.title, districtName: cand.name });
      } catch (err) {
        results.push({ via: p.via, confirmed: false, title: p.title, districtName: cand.name, error: String(err) });
      }
    });
  }
  await queue.onIdle();

  const summarize = (arr: typeof results) => {
    const ok = arr.filter((r) => !r.error);
    const conf = ok.filter((r) => r.confirmed).length;
    return { total: arr.length, ok: ok.length, errs: arr.length - ok.length, confirmed: conf, rejected: ok.length - conf };
  };
  const all = summarize(results);
  const h2 = summarize(results.filter((r) => r.via === "H2"));
  const h1 = summarize(results.filter((r) => r.via === "H1"));
  const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`);
  console.log(`  All: ${all.confirmed}/${all.ok} confirmed (${pct(all.confirmed, all.ok)}), ${all.rejected} rejected, ${all.errs} errors`);
  console.log(`  H2:  ${h2.confirmed}/${h2.ok} confirmed (${pct(h2.confirmed, h2.ok)})`);
  console.log(`  H1:  ${h1.confirmed}/${h1.ok} confirmed (${pct(h1.confirmed, h1.ok)})`);

  const rejected = results.filter((r) => !r.error && !r.confirmed);
  if (rejected.length > 0) {
    console.log("");
    console.log(`Sample rejections:`);
    for (const r of rejected.slice(0, 15)) {
      console.log(`  [${r.via}] ${r.districtName} — ${r.title.slice(0, 100)}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
