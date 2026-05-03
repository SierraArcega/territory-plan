# News Relevance Rubric Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow Fullmind-relevance rubric in the news classifier with a wider one, drop the unused `sentiment` field across the stack, expand `NEWS_CATEGORIES` from 11 to 16, and re-classify the backlog so older articles get the new rubric.

**Architecture:** All classification logic lives in one file (`src/features/news/lib/classifier.ts`) — system prompt, tool schema, parsing, and persistence. Touch points outward: Prisma schema (drop one column), API DTO (drop one field), query-agent column metadata (refresh three entries + two prose blocks). Backfill is a one-line `UPDATE` that lets the existing `classify-news` cron drain the queue over the next few hours. The feedback-loop UI deferred in the spec is **not** in this plan.

**Tech Stack:** TypeScript, Vitest, Prisma, PostgreSQL, Next.js (App Router), Anthropic SDK (Haiku).

**Spec:** `Docs/superpowers/specs/2026-05-03-news-relevance-rubric-reset-design.md`

---

## File Map

| File | Action | Why |
| --- | --- | --- |
| `src/features/news/lib/classifier.ts` | Modify | Swap SYSTEM_PROMPT, drop SENTIMENTS, expand NEWS_CATEGORIES, extract `parseClassificationResult` for testability |
| `src/features/news/lib/__tests__/classifier.test.ts` | Create | First tests for this file — covers new schema + parsing |
| `prisma/schema.prisma` | Modify | Drop `sentiment` column from `NewsArticle` |
| `prisma/migrations/<ts>_drop_news_sentiment/migration.sql` | Create (via `prisma migrate dev`) | DB schema migration |
| `src/app/api/news/route.ts` | Modify | Drop `sentiment` from `NewsArticleDto` and `toDto` |
| `src/lib/district-column-metadata.ts` | Modify | Drop sentiment entry, expand categories enum doc, rewrite fullmindRelevance description, drop sentiment from two SEMANTIC_CONTEXT prose blocks |

---

## Task 1: Test the new categories enum (TDD)

**Files:**
- Create: `src/features/news/lib/__tests__/classifier.test.ts`
- Modify: `src/features/news/lib/classifier.ts:7-19`

- [ ] **Step 1: Write the failing test**

Create `src/features/news/lib/__tests__/classifier.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { NEWS_CATEGORIES } from "../classifier";

describe("NEWS_CATEGORIES", () => {
  it("contains the 5 expanded categories", () => {
    expect(NEWS_CATEGORIES).toContain("vacancies_staffing");
    expect(NEWS_CATEGORIES).toContain("school_choice");
    expect(NEWS_CATEGORIES).toContain("procurement_rfp");
    expect(NEWS_CATEGORIES).toContain("tutoring_intervention");
    expect(NEWS_CATEGORIES).toContain("homeschool");
  });

  it("has exactly 16 categories", () => {
    expect(NEWS_CATEGORIES).toHaveLength(16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/news/lib/__tests__/classifier.test.ts`
Expected: FAIL — current `NEWS_CATEGORIES` has 11 items, none of the 5 new ones.

- [ ] **Step 3: Update the enum**

In `src/features/news/lib/classifier.ts:7-19`, replace the `NEWS_CATEGORIES` constant:

```ts
export const NEWS_CATEGORIES = [
  "budget_funding",
  "leadership_change",
  "vacancies_staffing",
  "academic_performance",
  "enrollment_trends",
  "labor_contract",
  "curriculum_adoption",
  "technology_edtech",
  "school_choice",
  "procurement_rfp",
  "policy_regulation",
  "facility_operations",
  "student_services",
  "tutoring_intervention",
  "homeschool",
  "scandal_incident",
] as const;
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/features/news/lib/__tests__/classifier.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/features/news/lib/classifier.ts src/features/news/lib/__tests__/classifier.test.ts
git commit -m "feat(news): expand NEWS_CATEGORIES from 11 to 16"
```

---

## Task 2: Extract `parseClassificationResult` and test it (TDD)

**Files:**
- Modify: `src/features/news/lib/classifier.ts:106-152`
- Modify: `src/features/news/lib/__tests__/classifier.test.ts`

This task pulls the inline parsing logic out of `classifyOne` into a pure exported function so we can test it without mocking the LLM. It still includes `sentiment` at this stage — the next task removes it.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/news/lib/__tests__/classifier.test.ts`:

```ts
import { parseClassificationResult } from "../classifier";

describe("parseClassificationResult", () => {
  it("returns a typed result for valid input", () => {
    const result = parseClassificationResult({
      sentiment: "positive",
      categories: ["budget_funding"],
      fullmindRelevance: "high",
    });
    expect(result).toEqual({
      sentiment: "positive",
      categories: ["budget_funding"],
      fullmindRelevance: "high",
    });
  });

  it("defaults invalid fullmindRelevance to 'none'", () => {
    const result = parseClassificationResult({
      sentiment: "neutral",
      categories: [],
      fullmindRelevance: "super-high",
    });
    expect(result?.fullmindRelevance).toBe("none");
  });

  it("filters out categories not in the enum", () => {
    const result = parseClassificationResult({
      sentiment: "neutral",
      categories: ["budget_funding", "not_a_real_category", "homeschool"],
      fullmindRelevance: "medium",
    });
    expect(result?.categories).toEqual(["budget_funding", "homeschool"]);
  });

  it("returns null for non-object input", () => {
    expect(parseClassificationResult(null)).toBeNull();
    expect(parseClassificationResult("nope")).toBeNull();
    expect(parseClassificationResult(42)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/news/lib/__tests__/classifier.test.ts`
Expected: FAIL — `parseClassificationResult` is not exported.

- [ ] **Step 3: Refactor `classifyOne` to use a new exported `parseClassificationResult`**

In `src/features/news/lib/classifier.ts`, **add** the new exported function above `classifyOne`:

```ts
/** Pure parser for the classify_article tool's input — pulled out of
 *  classifyOne so it can be unit-tested without mocking the LLM. */
export function parseClassificationResult(raw: unknown): ClassificationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const out = raw as {
    sentiment?: string;
    categories?: string[];
    fullmindRelevance?: string;
  };
  const sentiment = (SENTIMENTS as readonly string[]).includes(out.sentiment ?? "")
    ? (out.sentiment as Sentiment)
    : "neutral";
  const fullmindRelevance = (RELEVANCE_TIERS as readonly string[]).includes(
    out.fullmindRelevance ?? ""
  )
    ? (out.fullmindRelevance as Relevance)
    : "none";
  const categories = (out.categories ?? []).filter((c): c is NewsCategory =>
    (NEWS_CATEGORIES as readonly string[]).includes(c)
  );
  return { sentiment, categories, fullmindRelevance };
}
```

Then **replace lines 138-151 inside `classifyOne`** (the inline parsing) with:

```ts
  return parseClassificationResult(tool.input);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/news/lib/__tests__/classifier.test.ts`
Expected: PASS (6/6 — 2 from Task 1, 4 from this task).

- [ ] **Step 5: Commit**

```bash
git add src/features/news/lib/classifier.ts src/features/news/lib/__tests__/classifier.test.ts
git commit -m "refactor(news): extract parseClassificationResult for testability"
```

---

## Task 3: Drop `sentiment` from the classifier output (TDD)

**Files:**
- Modify: `src/features/news/lib/classifier.ts` (multiple locations)
- Modify: `src/features/news/lib/__tests__/classifier.test.ts`

- [ ] **Step 1: Update tests to assert sentiment is gone**

In `src/features/news/lib/__tests__/classifier.test.ts`, **replace** the existing `parseClassificationResult` tests with:

```ts
describe("parseClassificationResult", () => {
  it("returns a typed result for valid input (no sentiment field)", () => {
    const result = parseClassificationResult({
      categories: ["budget_funding"],
      fullmindRelevance: "high",
    });
    expect(result).toEqual({
      categories: ["budget_funding"],
      fullmindRelevance: "high",
    });
  });

  it("ignores sentiment if the LLM returns it", () => {
    const result = parseClassificationResult({
      sentiment: "positive",
      categories: [],
      fullmindRelevance: "high",
    });
    expect(result).not.toHaveProperty("sentiment");
  });

  it("defaults invalid fullmindRelevance to 'none'", () => {
    const result = parseClassificationResult({
      categories: [],
      fullmindRelevance: "super-high",
    });
    expect(result?.fullmindRelevance).toBe("none");
  });

  it("filters out categories not in the enum", () => {
    const result = parseClassificationResult({
      categories: ["budget_funding", "not_a_real_category", "homeschool"],
      fullmindRelevance: "medium",
    });
    expect(result?.categories).toEqual(["budget_funding", "homeschool"]);
  });

  it("returns null for non-object input", () => {
    expect(parseClassificationResult(null)).toBeNull();
    expect(parseClassificationResult("nope")).toBeNull();
    expect(parseClassificationResult(42)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/news/lib/__tests__/classifier.test.ts`
Expected: FAIL — `parseClassificationResult` still emits `sentiment: "neutral"`.

- [ ] **Step 3: Remove sentiment from the source**

In `src/features/news/lib/classifier.ts`:

**a)** Delete the `SENTIMENTS` constant and `Sentiment` type (around lines 23-24):

```ts
// DELETE these two lines:
export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];
```

**b)** Update `ClassificationResult` (around lines 29-33):

```ts
interface ClassificationResult {
  categories: NewsCategory[];
  fullmindRelevance: Relevance;
}
```

**c)** Remove the `sentiment` property from `CLASSIFY_TOOL.input_schema.properties` and from `required` (around lines 49-67). The `properties` object should now contain only `categories` and `fullmindRelevance`; `required` should be `["categories", "fullmindRelevance"] as const`.

**d)** Update `parseClassificationResult` to drop the sentiment branch:

```ts
export function parseClassificationResult(raw: unknown): ClassificationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const out = raw as {
    categories?: string[];
    fullmindRelevance?: string;
  };
  const fullmindRelevance = (RELEVANCE_TIERS as readonly string[]).includes(
    out.fullmindRelevance ?? ""
  )
    ? (out.fullmindRelevance as Relevance)
    : "none";
  const categories = (out.categories ?? []).filter((c): c is NewsCategory =>
    (NEWS_CATEGORIES as readonly string[]).includes(c)
  );
  return { categories, fullmindRelevance };
}
```

**e)** Update the `prisma.newsArticle.update` call inside `classifyMany` (around lines 209-217) to drop `sentiment`:

```ts
        await prisma.newsArticle.update({
          where: { id: a.id },
          data: {
            categories: result.categories,
            fullmindRelevance: result.fullmindRelevance,
            classifiedAt: new Date(),
          },
        });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/news/lib/__tests__/classifier.test.ts`
Expected: PASS (7/7).

- [ ] **Step 5: Run a typecheck on the file**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "classifier|sentiment" || echo "clean"`
Expected: `clean` (no errors mentioning classifier or sentiment).

- [ ] **Step 6: Commit**

```bash
git add src/features/news/lib/classifier.ts src/features/news/lib/__tests__/classifier.test.ts
git commit -m "feat(news): drop sentiment from classifier output"
```

---

## Task 4: Rewrite `SYSTEM_PROMPT` with the new rubric

**Files:**
- Modify: `src/features/news/lib/classifier.ts:71-104`

- [ ] **Step 1: Replace the SYSTEM_PROMPT constant**

In `src/features/news/lib/classifier.ts`, replace the entire `SYSTEM_PROMPT` constant with:

```ts
const SYSTEM_PROMPT = `You classify K-12 news articles for Fullmind Learning — a company that sells on-demand online tutoring, virtual teachers, and intervention services to public school districts.

Articles arrive as headlines (sometimes with a 1-sentence description). The audience is a Fullmind sales rep working a K-12 territory. An article is useful if it (a) gives the rep something to act on, (b) gives them something to talk about with a contact, or (c) gives context that changes how they think about the district.

You must return:
1. categories: zero or more topic tags from the fixed list
2. fullmindRelevance: how useful for the rep, on a 4-tier scale

CATEGORIES (pick all that apply; empty array is valid):
  • budget_funding         — bonds, levies, grants, cuts, ESSER, state/federal funding
  • leadership_change      — superintendent, CFO, board, director-level transitions
  • vacancies_staffing     — open positions, hiring freezes, RIFs, layoffs, "can't fill" stories
  • academic_performance   — test scores, accountability ratings, learning loss
  • enrollment_trends      — growth, decline, demographic shifts
  • labor_contract         — strikes, unions, contract negotiations
  • curriculum_adoption    — vendor selection, textbook decisions
  • technology_edtech      — digital learning, AI, devices
  • school_choice          — vouchers, charters, open enrollment, virtual schools, choice competition
  • procurement_rfp        — RFP/RFI announcements, vendor selection, contract awards (any subject)
  • policy_regulation      — state/federal mandates, new laws
  • facility_operations    — closings, openings, construction, infrastructure
  • student_services       — SPED, SEL, mental health, counseling
  • tutoring_intervention  — tutoring, intervention, learning-recovery programs (Fullmind's or competitors')
  • homeschool             — homeschool growth, hybrid homeschool programs, district homeschool support
  • scandal_incident       — investigations, legal, safety, misconduct

FULLMIND RELEVANCE — sales-rep lens:

  HIGH — direct prompt for action this week:
    • Leadership change: new sup, CFO, director of intervention/curriculum/SPED, flagship principal
    • Money moving: any budget news (approval, cut, deficit, surplus), bond/levy/referendum result, grant award, ESSER reallocation, settlement, new funding stream
    • Vacancies & staffing: open positions (esp. teacher, SPED, math, ELL), staff reductions, layoffs, RIFs, hiring freezes, "can't fill" stories
    • Competitive / structural shifts: open enrollment changes, school choice / voucher activity, charter expansion, homeschool growth or hybrid homeschool programs, virtual school launch or expansion, new online learning program
    • Procurement & vendor signals: RFP, contract award, vendor selection (any subject)
    • Problem statements: accountability rating drop, state takeover threat, IEP non-compliance, special-ed lawsuit, learning-loss data release, achievement-gap report
    • Programmatic announcements: tutoring program (theirs or a competitor's), intervention program rollout
    • Labor disruption: strike, union action, major labor news

  MEDIUM — useful context, not urgent:
    • Curriculum adoption outside tutoring/intervention
    • Mental health / SEL expansion
    • Test score release without crisis framing
    • Routine board / governance changes below director level
    • Major facility news (school opens / closes) — district trajectory signal
    • Routine enrollment trend reports without choice/competition framing

  LOW — skippable K-12 news from the district:
    • Sports, musicals, individual student achievements
    • Routine state policy updates without district-level effect
    • Building maintenance, busing, schedule, weather closures
    • Social justice / DEI articles (commentary, programs, controversy)
    • Crime, student investigations, staff investigations
      (Edge case: if an investigation drives a leadership departure, that's HIGH leadership_change — judge accordingly)

  NONE — drop from the feed:
    • Higher-ed, private school, edtech industry without district application
    • Articles where the district is mentioned only in passing (one-off byline, list of districts)

Default tendency: lean MEDIUM over LOW when uncertain. Reps prefer skimming 5 medium articles to missing 1 real signal.

Call the classify_article tool with your decision.`;
```

- [ ] **Step 2: Run tests + typecheck**

Run: `npx vitest run src/features/news/lib/__tests__/classifier.test.ts`
Expected: PASS (still 7/7 — the prompt change doesn't affect parsing).

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "classifier" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit**

```bash
git add src/features/news/lib/classifier.ts
git commit -m "feat(news): rewrite Fullmind-relevance rubric with wider HIGH net"
```

---

## Task 5: Drop `sentiment` column from the database

**Files:**
- Modify: `prisma/schema.prisma:1735`
- Create: `prisma/migrations/<timestamp>_drop_news_sentiment/migration.sql` (auto-generated)

- [ ] **Step 1: Remove the field from the Prisma schema**

In `prisma/schema.prisma:1735`, delete this line from the `NewsArticle` model:

```
  sentiment         String?   @db.VarChar(10)
```

The remaining classification block becomes:

```
  // Classification — set by the Haiku classifier pass. Null until classified.
  categories        String[]  @default([]) @db.VarChar(40)
  fullmindRelevance String?   @map("fullmind_relevance") @db.VarChar(10)
  classifiedAt      DateTime? @map("classified_at")
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name drop_news_sentiment`
Expected: Prisma creates a new directory under `prisma/migrations/` containing a `migration.sql` whose only meaningful line is `ALTER TABLE "news_articles" DROP COLUMN "sentiment";`. Prisma client regenerates automatically.

If the dev DB is unavailable, fall back to: `npx prisma migrate dev --create-only --name drop_news_sentiment` and apply manually with `psql -c 'ALTER TABLE news_articles DROP COLUMN sentiment;'`.

- [ ] **Step 3: Verify the generated SQL**

Open the new `prisma/migrations/<timestamp>_drop_news_sentiment/migration.sql` and confirm it contains exactly:

```sql
-- AlterTable
ALTER TABLE "news_articles" DROP COLUMN "sentiment";
```

- [ ] **Step 4: Run a typecheck — Prisma client should now reject `sentiment`**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i sentiment || echo "clean"`
Expected: `clean` if Tasks 3 (classifier.ts) was committed correctly. If anything else still references `prisma.newsArticle.sentiment`, the typecheck will surface it now — fix in place before committing.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(news): drop sentiment column from news_articles"
```

---

## Task 6: Drop `sentiment` from the API DTO

**Files:**
- Modify: `src/app/api/news/route.ts:12-28` (NewsArticleDto interface)
- Modify: `src/app/api/news/route.ts:230-266` (toDto function)

- [ ] **Step 1: Update `NewsArticleDto`**

In `src/app/api/news/route.ts`, remove the `sentiment` line from the interface:

```ts
export interface NewsArticleDto {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  author: string | null;
  source: string;
  feedSource: string;
  publishedAt: string;
  categories: string[];
  fullmindRelevance: string | null;
  confidence?: string;
  districtLeaid?: string;
  districtName?: string;
}
```

- [ ] **Step 2: Update `toDto`**

In the same file, update the `toDto` function. Remove `sentiment: string | null;` from the parameter type and remove the `sentiment: article.sentiment,` line from the returned object:

```ts
function toDto(
  article: {
    id: string;
    url: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    author: string | null;
    source: string;
    feedSource: string;
    publishedAt: Date;
    categories: string[];
    fullmindRelevance: string | null;
  },
  confidence: string,
  districtLeaid?: string,
  districtName?: string
): NewsArticleDto {
  return {
    id: article.id,
    url: article.url,
    title: article.title,
    description: article.description,
    imageUrl: article.imageUrl,
    author: article.author,
    source: article.source,
    feedSource: article.feedSource,
    publishedAt: article.publishedAt.toISOString(),
    categories: article.categories,
    fullmindRelevance: article.fullmindRelevance,
    confidence,
    districtLeaid,
    districtName,
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "news/route\|NewsArticleDto" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/news/route.ts
git commit -m "feat(news): drop sentiment from /api/news DTO"
```

---

## Task 7: Update query-agent column metadata

**Files:**
- Modify: `src/lib/district-column-metadata.ts:2588-2611` (NEWS_ARTICLE_COLUMNS block)

- [ ] **Step 1: Update the docblock comment (line 2588-2592)**

Replace the existing comment:

```ts
/**
 * news_articles — RSS + Google News ingestion of K-12 news, matched to
 * districts/schools/contacts via junction tables and classified by a Haiku
 * pass for topic categories and Fullmind sales relevance.
 */
```

(Removed: ", sentiment".)

- [ ] **Step 2: Delete the sentiment column entry (line 2607)**

Delete this entire line:

```ts
  { field: "sentiment", column: "sentiment", label: "Sentiment", description: "Haiku classifier output. Full enum: 'positive', 'neutral', 'negative'. NULL until the article is classified — filtering on sentiment IS NOT NULL excludes the unclassified backlog. For 'negative news' / 'bad news at <district>' rep questions, filter sentiment = 'negative'.", domain: "news", format: "text", source: "news_ingest", queryable: true },
```

- [ ] **Step 3: Update the `categories` entry with the 16-item enum (line 2608)**

Replace it with:

```ts
  { field: "categories", column: "categories", label: "Categories", description: "Haiku-assigned topic tags (text[]). Full enum: 'budget_funding', 'leadership_change', 'vacancies_staffing', 'academic_performance', 'enrollment_trends', 'labor_contract', 'curriculum_adoption', 'technology_edtech', 'school_choice', 'procurement_rfp', 'policy_regulation', 'facility_operations', 'student_services', 'tutoring_intervention', 'homeschool', 'scandal_incident'. Use postgres array ops: categories && ARRAY['budget_funding','leadership_change'] for any-match, or 'tutoring_intervention' = ANY(categories). Empty array means classifier ran but nothing applied; NULL means not yet classified.", domain: "news", format: "text", source: "news_ingest", queryable: true },
```

- [ ] **Step 4: Rewrite the `fullmindRelevance` description (line 2609)**

Replace it with:

```ts
  { field: "fullmindRelevance", column: "fullmind_relevance", label: "Fullmind Relevance", description: "Sales-actionability tier from the Haiku classifier. Full enum: 'high' (direct action this week — leadership change, any budget movement, vacancies/layoffs, school choice / vouchers / virtual schools / homeschool, RFPs in any subject, accountability/lawsuit/learning-loss problem statements, tutoring or intervention announcements), 'medium' (useful context — non-tutoring curriculum, SEL/mental-health expansion, routine test scores, sub-director board changes, facility news, plain enrollment trends), 'low' (skippable district news — sports, routine state policy, facilities, social justice / DEI commentary, crime / investigations), 'none' (off-topic — higher-ed, private school, passing-mention articles). NULL until classified. For 'high-priority news' / 'sales-relevant news' default to fullmind_relevance IN ('high','medium'). Indexed alongside published_at.", domain: "news", format: "text", source: "news_ingest", queryable: true },
```

- [ ] **Step 5: Update the `classifiedAt` description (line 2610)**

Replace it with:

```ts
  { field: "classifiedAt", column: "classified_at", label: "Classified At", description: "When the Haiku classifier ran. NULL = not yet classified (categories / fullmind_relevance will both be null on those rows).", domain: "news", format: "date", source: "news_ingest", queryable: true },
```

(Removed: "sentiment / ".)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "district-column-metadata" || echo "clean"`
Expected: `clean`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(query-agent): refresh news column metadata for new rubric"
```

---

## Task 8: Update query-agent SEMANTIC_CONTEXT prose

**Files:**
- Modify: `src/lib/district-column-metadata.ts:3186` (news-table SEMANTIC_CONTEXT block)
- Modify: `src/lib/district-column-metadata.ts:3623` (NEWS QUERY DEFAULTS block)

- [ ] **Step 1: Update the news-table SEMANTIC_CONTEXT (line 3186)**

Find the block that begins with `"K-12 news articles ingested from RSS"` and replace it with:

```ts
      "K-12 news articles ingested from RSS (Chalkbeat, K12 Dive, The 74, EdSurge), Google News (industry-topic + per-district queries), and admin manual refreshes. Classified by a Haiku pass for topic categories and Fullmind sales relevance — those columns are NULL until the classifier runs. Article-to-entity matching is many-to-many via three junctions: news_article_districts, news_article_schools, news_article_contacts. Rep questions split three ways: (1) per-entity coverage ('news at <district>', 'recent news at my schools', 'articles mentioning <superintendent>') — go through the junction, (2) per-state recency ('news in TX this week', 'recent CA coverage') — use state_abbrevs (postgres text[]) WITHOUT the junction, (3) industry trends ('what's been hot in K-12 news this month', 'most-covered topics') — group by categories or feed_source on news_articles directly. For 'sales-relevant news' default to fullmind_relevance IN ('high','medium'). Articles can outlive their classification window — when filtering by categories / fullmind_relevance, surface a brief caveat that unclassified articles are excluded. Always order by published_at DESC for recency questions.",
```

(Changes: dropped ", sentiment" in the Haiku-pass clause; dropped "sentiment / " in the filtering caveat clause.)

- [ ] **Step 2: Update the NEWS QUERY DEFAULTS block (line 3623)**

Find the block that begins with `"NEWS QUERY DEFAULTS:"` and replace it with:

```ts
        "NEWS QUERY DEFAULTS: (1) When joining any of the three news junctions (news_article_districts / news_article_schools / news_article_contacts), DEFAULT to confidence IN ('high','llm'). The third value 'low' is uncertain matches and pollutes rep-facing results — only include it when the rep explicitly asks for everything. There is no 'medium' value; 'llm' IS the medium tier. (2) Classification columns (categories, fullmind_relevance, classified_at) are NULL on the unclassified backlog. Filtering on any of them silently drops those rows — when a rep asks 'all news at <district>' or 'this week's coverage' WITHOUT a category/relevance filter, do NOT add one (you'll under-count). When a rep DOES filter on classification ('sales-relevant news', 'leadership change news'), add a brief caveat that unclassified articles are excluded. (3) Always order by published_at DESC for recency questions; the (published_at) and (fullmind_relevance, published_at) indexes make this fast. (4) For per-state recency ('news in TX'), use news_articles.state_abbrevs (postgres text[]) directly with the && or = ANY operators — going through the district junction is slower and unnecessary unless the rep wants per-district drill-in. (5) For 'sales-relevant news' default fullmind_relevance IN ('high','medium').",
```

(Changes: dropped "sentiment, " from the classification-columns list; dropped "'negative news', " from the filter-example list; dropped the "sentiment/" qualifier in the parenthetical.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "district-column-metadata" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/district-column-metadata.ts
git commit -m "feat(query-agent): drop sentiment from news SEMANTIC_CONTEXT prose"
```

---

## Task 9: Verify clean — full grep, full test suite, full typecheck

**Files:** none (verification only)

- [ ] **Step 1: Grep for any remaining news-sentiment references**

Run:

```bash
grep -rn "newsArticle.sentiment\|news_articles.*sentiment\|article\.sentiment" \
  --include="*.ts" --include="*.tsx" \
  src/ prisma/
```

Expected: no output. (The `sentiment` field on `Activity` is a different domain — that grep deliberately excludes it. If you see hits, they're real bugs to fix before continuing.)

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS. The new `classifier.test.ts` adds 7 tests; nothing existing should regress.

- [ ] **Step 3: Run a full project typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 4: Commit (only if Step 1/2/3 surfaced fixes)**

If Steps 1-3 required follow-on edits, stage and commit them:

```bash
git add <fixed files>
git commit -m "fix(news): clean up stragglers after sentiment removal"
```

If everything was already clean, skip the commit.

---

## Task 10: Backfill the classification (post-deploy ops step)

**Files:** none (database operation)

This task runs **after** the code from Tasks 1-9 is deployed. It is a manual ops step, not a code change.

- [ ] **Step 1: Confirm deployment**

Verify the new classifier code is running in the target environment (production or staging — wherever you're backfilling). The `/api/cron/classify-news` cron must already be picking up the new SYSTEM_PROMPT and 16-category enum.

- [ ] **Step 2: Get the article count for cost estimation**

Run against the target DB (psql, Supabase studio, or a one-off `prisma.newsArticle.count()` script):

```sql
SELECT COUNT(*) FROM news_articles;
```

Multiply by ~$0.001 for a Haiku-pricing estimate. Confirm with stakeholder if the figure is meaningful (e.g., > $20).

- [ ] **Step 3: Run the backfill UPDATE**

```sql
UPDATE news_articles SET classified_at = NULL;
```

This resets every row to "unclassified." The existing `classify-news` cron (default `limit=200`, concurrency 8) will re-process them on each tick.

- [ ] **Step 4: Monitor classification draining**

Over the next hours, periodically check:

```sql
SELECT
  COUNT(*) FILTER (WHERE classified_at IS NULL) AS unclassified,
  COUNT(*) FILTER (WHERE classified_at IS NOT NULL) AS classified,
  COUNT(*) FILTER (WHERE fullmind_relevance = 'high') AS high,
  COUNT(*) FILTER (WHERE fullmind_relevance = 'medium') AS medium,
  COUNT(*) FILTER (WHERE fullmind_relevance = 'low') AS low,
  COUNT(*) FILTER (WHERE fullmind_relevance = 'none') AS none
FROM news_articles;
```

The `unclassified` number should monotonically decrease. The HIGH count is expected to be meaningfully larger than it was pre-rubric-change — that is the goal.

If the cron pace is unacceptable, trigger one-off batches by calling `/api/cron/classify-news` directly (admin auth) or run `classifyUnclassified(limit=1000, concurrency=8, timeBudgetMs=120000)` from a one-off script.

- [ ] **Step 5: Spot-check the new ratings**

Sample 10-20 freshly re-classified articles and sanity-check the new tiers:

```sql
SELECT title, fullmind_relevance, categories
FROM news_articles
WHERE classified_at > now() - interval '1 hour'
ORDER BY random()
LIMIT 20;
```

In particular, look for:
- A vacancies / layoffs article rated HIGH ✓
- A homeschool / virtual-school article rated HIGH ✓
- A sports / DEI / facility article rated LOW ✓
- An investigation that drove a leadership change rated HIGH leadership_change ✓ (edge-case from rubric)

If multiple articles are mis-tiered, document the patterns and open a follow-up to refine the prompt.

---

## Done

After Task 10, the rubric reset is fully shipped. Saved reports that filter on `fullmind_relevance = 'high'` will see result counts shift upward — call this out in release notes.

The deferred feedback-loop UI is documented at the end of `Docs/superpowers/specs/2026-05-03-news-relevance-rubric-reset-design.md` and should be picked up as its own spec when news has a rep-facing surface to render in.
