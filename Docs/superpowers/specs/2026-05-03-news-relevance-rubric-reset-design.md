# News Relevance Rubric Reset

**Date:** 2026-05-03
**Status:** Draft — pending implementation plan
**Owner:** Sierra
**Related code:** `src/features/news/lib/classifier.ts`, `src/lib/district-column-metadata.ts`, `prisma/schema.prisma` (`NewsArticle`)

## Problem

The Haiku classifier that scores incoming K-12 news articles for "Fullmind relevance" produces too many false negatives — genuinely useful articles land in `low` or `none` and never reach the rep. Two root causes:

1. **The rubric is too narrow.** The current `SYSTEM_PROMPT` reserves `high` for direct selling moments (RFPs, Title I, ESSER, learning-loss crisis driving intervention budget). It misses the majority of signals reps actually act on: leadership changes, vacancies, layoffs, school choice / vouchers, virtual schools, homeschool growth, RFPs across any subject, and explicit tutoring/intervention announcements.
2. **The rubric is an untunable black box.** It lives in a TypeScript file as a system-prompt string. Nobody can correct mistakes without a code deploy. There is no feedback loop from rep behavior back into the classifier.

This spec addresses cause (1) directly and lays out the design for the eventual fix to (2), to be built when news has a rep-facing UI surface.

## In-Scope (this spec)

1. **Replace the rubric** in `classifier.ts` with the new HIGH/MEDIUM/LOW/NONE definition below.
2. **Drop `sentiment`** from the classifier output, the database, the API DTO, and the query-agent column metadata. It is unused downstream.
3. **Expand `NEWS_CATEGORIES`** from 11 to 16 tags. Update query-agent column metadata to match.
4. **Re-classify the existing backlog** under the new rubric by setting `classified_at = NULL` on every row in `news_articles` and letting the existing `classify-news` cron drain the queue.

## Out-of-Scope (deferred)

The **feedback loop** — UI tier-overrides that train the classifier — is fully designed in the "Deferred Design" section at the end of this spec, but its implementation waits for news to have a rep-facing UI surface. Reps cannot give feedback on a news feed they cannot see.

---

## The New Rubric

### Audience and intent

The classifier is scoring articles for a Fullmind sales rep working a K-12 territory. Fullmind sells on-demand online tutoring, virtual teachers, and intervention services to public school districts. An article is useful if it (a) gives the rep something to **act on**, (b) gives them something to **talk about** with a contact, or (c) gives **context** that changes how they think about the district.

### Tiers

**HIGH** — direct prompt for action this week:

- **Leadership change** — new superintendent, CFO, director of intervention / curriculum / SPED, flagship principal. (Someone to reach out to.)
- **Money moving** — any budget news (approval, cut, deficit, surplus), bond / levy / referendum result, grant award, ESSER reallocation, settlement, new funding stream.
- **Vacancies & staffing** — open positions (especially teacher, SPED, math, ELL), staff reductions, layoffs, RIFs, hiring freezes, "can't fill" stories.
- **Competitive / structural shifts** — open enrollment changes, school choice / voucher activity, charter expansion, **homeschool growth or hybrid homeschool programs**, virtual school launch or expansion, new online learning program.
- **Procurement & vendor signals** — RFP, contract award, vendor selection (any subject — tutoring, intervention, virtual instruction, or adjacent services).
- **Problem statements** — accountability rating drop, state takeover threat, IEP non-compliance, special-ed lawsuit, learning-loss data release, achievement-gap report.
- **Programmatic announcements** — tutoring program (Fullmind's or a competitor's), intervention program rollout.
- **Labor disruption** — strike, union action, major labor news.

**MEDIUM** — useful context, not urgent:

- Curriculum adoption outside tutoring/intervention.
- Mental health / SEL expansion.
- Test score release without crisis framing.
- Routine board / governance changes below director level.
- Major facility news (school opens / closes) — district trajectory signal.
- Routine enrollment trend reports without choice/competition framing.

**LOW** — skippable K-12 news from the district:

- Sports, musicals, individual student achievements.
- Routine state policy updates without district-level effect.
- Building maintenance, busing, schedule, weather closures.
- Social justice / DEI articles (commentary, programs, controversy).
- Crime, student investigations, staff investigations. *(Edge case: if an investigation drives a leadership departure, that's HIGH leadership change — the LLM should make that judgment.)*

**NONE** — drop from the feed:

- Higher-ed, private school, edtech industry without district application.
- Articles where the district is mentioned only in passing (one-off byline, list of districts).

**Default tendency:** lean MEDIUM over LOW when uncertain. Reps prefer skimming 5 medium articles to missing 1 real signal.

### Classifier output schema

```ts
{
  categories: NewsCategory[],          // 16-item enum, multi-select; empty array allowed
  fullmindRelevance: "high" | "medium" | "low" | "none"
}
```

`sentiment` is removed.

### Categories (16)

| Category | Covers |
| --- | --- |
| `budget_funding` | Bonds, levies, grants, cuts, ESSER, state/federal funding |
| `leadership_change` | Sup, CFO, board, director-level transitions |
| `vacancies_staffing` | Open positions, hiring freezes, RIFs, layoffs, "can't fill" |
| `academic_performance` | Test scores, accountability, learning loss |
| `enrollment_trends` | Growth, decline, demographic shifts |
| `labor_contract` | Strikes, unions, contract negotiations |
| `curriculum_adoption` | Vendor selection, textbook decisions |
| `technology_edtech` | Digital learning, AI, devices |
| `school_choice` | Vouchers, charters, open enrollment, virtual schools, choice competition |
| `procurement_rfp` | RFP / RFI announcements, vendor selection, contract awards (any subject) |
| `policy_regulation` | State / federal mandates, new laws |
| `facility_operations` | Closings, openings, construction, infrastructure |
| `student_services` | SPED, SEL, mental health, counseling |
| `tutoring_intervention` | Tutoring, intervention, learning-recovery programs (theirs or competitors') |
| `homeschool` | Homeschool growth, hybrid homeschool programs, district homeschool support |
| `scandal_incident` | Investigations, legal, safety, misconduct |

The 5 additions (`vacancies_staffing`, `school_choice`, `procurement_rfp`, `tutoring_intervention`, `homeschool`) are the categories most aligned with the new HIGH triggers and let reps filter the feed to "show me only RFPs" or "show me only homeschool / virtual school news" without needing free-text search.

---

## Implementation Surfaces

### 1. `src/features/news/lib/classifier.ts`

- Rewrite `SYSTEM_PROMPT` to the new rubric above.
- Remove `SENTIMENTS` enum, `Sentiment` type, and the `sentiment` property from `CLASSIFY_TOOL.input_schema` (and `required`).
- Remove `sentiment` from `ClassificationResult`.
- Remove `sentiment` from the `prisma.newsArticle.update({ data: ... })` call inside `classifyMany`.
- Update `NEWS_CATEGORIES` to the 16-item list.

### 2. `prisma/schema.prisma` (`NewsArticle` model)

- Drop the `sentiment` field. Generate a migration.
- `categories String[]` is unchanged in shape; new enum values flow through naturally.

### 3. API DTO — `src/app/api/news/route.ts`

- Remove `sentiment: string | null` from `NewsArticleDto`.
- Remove `sentiment` from the `toDto` mapping.
- (No filter logic to update — `sentiment` was never queryable via this route.)

### 4. Query-agent column metadata — `src/lib/district-column-metadata.ts`

- Remove the `sentiment` column entry (around line 2607).
- Rewrite the `fullmindRelevance` description (around line 2609) to summarize the new rubric in the same dense style as the surrounding entries — call out that HIGH now includes leadership/vacancies/staffing/choice/RFP/tutoring/homeschool signals, not just RFP/Title-I/ESSER.
- Update the news-table SEMANTIC_CONTEXT block (around line 3186 and 3623) to drop sentiment references and reflect the new rubric.
- The default of `fullmind_relevance IN ('high','medium')` for "sales-relevant news" stays correct.
- (The categories enum is described in prose, not enumerated as a column option list — verify during implementation whether the enum values need to be listed anywhere the agent sees, and if so, expand to all 16.)

### 5. Backfill the classification

Once the code changes are deployed:

```sql
UPDATE news_articles SET classified_at = NULL;
```

The existing `classify-news` cron drains `classifiedAt IS NULL` rows on each tick (default `limit=200`, concurrency 8). Running every few minutes, the entire backlog will re-classify over hours, not seconds — that is fine. No new endpoint or one-shot job is required.

If the backlog is large enough that the rolling cron's pace is unacceptable, an admin-only `/api/admin/news-reclassify` endpoint can be added that runs `classifyUnclassified` with a larger `limit` and longer `timeBudgetMs`. Treat this as optional / on-demand.

---

## Risks

- **Saved reports / queries that filter `fullmind_relevance = 'high'` will see result counts shift** — likely upward, since the new rubric widens HIGH meaningfully. Worth a release-note callout. No data is lost; old "low" articles whose rating moves to "high" simply become more visible.
- **Backlog re-classification is a real LLM cost** — every existing row in `news_articles` re-runs through Haiku once. At roughly 500 input + ~50 output tokens per call, this is on the order of $0.001 per article at current Haiku pricing — i.e. ~$10 per 10K articles, ~$50 per 50K. Worth running `SELECT COUNT(*) FROM news_articles` before kicking off the backfill so the dollar figure is concrete, not estimated.
- **Dropping the `sentiment` column is irreversible without a restore.** The grep confirmed no UI / API consumer reads it (the `sentiment` field on `Activity` is a different domain). If a future feature wants article tone, it can be re-added then.
- **The rubric's "edge case" guidance** ("if an investigation drives a leadership departure, that's HIGH leadership change") relies on the LLM making the judgment. Worth spot-checking the first few re-classifications to confirm Haiku honors it.

---

## Deferred Design — Feedback Loop

Recorded here so a future spec can pick it up without re-doing the brainstorm. **Do not build this as part of the in-scope work.**

### Trigger

Build this when news articles render in a rep-facing UI surface — district pages, territory feed, contact pages, etc. Without that surface, reps have nowhere to give feedback.

### Mechanism — tier override

- The relevance pill on every news card ("High" / "Medium" / "Low") becomes a small dropdown.
- The rep clicks the pill → menu shows the four tiers — picks the one they think is correct.
- Same number of clicks as a thumbs up/down, but the signal is structurally richer: "model said `medium`, rep said `high`" is a directly trainable correction. No freeform "why" field — friction cost outweighs benefit; reps will skip it.

### Storage — new table

```prisma
model NewsArticleRelevanceOverride {
  id              String   @id @default(cuid())
  articleId       String   @map("article_id")
  userId          String   @map("user_id")
  originalTier    String   @map("original_tier") @db.VarChar(10)
  correctedTier   String   @map("corrected_tier") @db.VarChar(10)
  createdAt       DateTime @default(now()) @map("created_at")

  article NewsArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([articleId, userId])    // one override per rep per article; latest wins
  @@index([articleId])
  @@map("news_article_relevance_overrides")
}
```

### Two effects of an override

1. **Personal view (immediate).** The rep's UI immediately shows the corrected tier on that article (their personal truth; they do not have to keep seeing the wrong rating).
2. **Global few-shot pool (next classifier run).** Aggregated overrides feed an in-context example pool that gets injected into the classifier system prompt on the next ingest / cron tick.

### Few-shot pool design

- Pool stores recent overrides as `{title, description, model_tier, corrected_tier}` examples.
- Pool size capped — propose 30–50 examples (sliding window, most recent first). Past that, prompt token cost grows and signal-to-noise degrades.
- **Conflict resolution:** if multiple reps disagree on the same article, vote count wins (majority tier); ties drop the example from the pool.
- The pool is built lazily on classifier startup (or with a short TTL cache), not per-call.

### Re-classification scope

- **Going forward only.** New articles benefit from the updated pool the next time the cron runs. Old articles keep their existing rating unless an admin manually triggers a backfill (same shape as the in-scope backfill above).
- Per-rep overrides persist regardless of re-classification — the rep's personal view stays consistent.

### Why not personal re-rank

Personal re-ranking (each rep gets a learned model on their own thumbs history) sounds appealing but fails on sparseness — reps will not thumb enough articles for a per-rep signal to converge in a useful timeframe. A shared pool reaches useful signal much faster, and one rep's outlier vote gets washed out by aggregation. Personal preferences can come back as a v2 if the global pool turns out to be insufficient.

### Why not let the LLM rewrite the rubric directly

Tempting (an LLM job that periodically reads the override pool and proposes edits to the system prompt), but the few-shot pool is functionally equivalent and avoids the failure mode of an LLM-rewritten rubric drifting away from the human-readable version. Treat the rubric document as the source of truth and let in-context examples carry the per-incident corrections.
