# Feature Spec: RFP Classification — Relevance, Keywords, Disqualifiers, Funding, Pipeline Signal

**Date:** 2026-05-05
**Slug:** rfp-classification
**Branch:** `feat/rfp-feed-agency-district-map` (continues current branch)
**Phase 1 spec:** [`2026-05-04-rfp-feed-backend-spec.md`](./2026-05-04-rfp-feed-backend-spec.md)
**Phase 2 spec:** [`2026-05-04-rfp-feed-agency-district-map-design.md`](./2026-05-04-rfp-feed-agency-district-map-design.md)

## Summary

Phase 3 of the RFP Feed feature. Phases 1 and 2 ship the ingest pipeline and the manual agency-district triage UI. The result is ~548 RFPs in the database keyed to districts, but reps still have to read each title and description to decide whether to bid. This phase adds an LLM classification pass (Haiku, run on a cron decoupled from ingest) that annotates each RFP with:

1. **Topical relevance** to Fullmind's service catalog (`high|medium|low|none`).
2. **Extracted keywords** (~10 phrases) for free-text search and auditability.
3. **Disqualifier flags** (set-aside type, in-state-only, cooperative-eligible, required state W9) so reps filter out structurally-unbiddable RFPs before reading.
4. **Funding source tags** (ESSER, Title I, IDEA, etc.) as a structured enum array — separate from keywords, so seasonal pressure (ESSER's Sept 2026 sunset) is filterable.
5. **District pipeline signal** (`active|recently_won|recently_lost|top_icp|cold`) computed from existing CRM state — surfaces deal proximity so reps prioritize RFPs at districts they already have heat on.

Mirrors the existing news classifier pattern (`src/features/news/lib/classifier.ts`) and reuses the `fullmind_relevance` semantics so the query tool's hardened defaults transfer cleanly.

## Requirements

- Per-RFP classification: relevance + keywords + disqualifiers + funding sources, set by an LLM pass.
- Per-RFP pipeline signal: derived from current CRM state at the resolved district.
- Classification decoupled from ingest — sync stays fast, classifier runs on its own cron and is idempotent.
- Backfill: one-shot script classifies the existing ~548 RFPs.
- All new fields nullable / default-empty so unclassified rows remain queryable without filter gymnastics.
- The query tool's agent prefers `fullmind_relevance IN ('high','medium')` by default for "find me RFPs" questions, mirroring the news pattern.
- All five signals surface in the rep-facing RFP feed UI as filter chips and sort options (UI work scoped in a follow-up; this spec covers backend + classification only).

## Non-Goals

- UI changes to the rep-facing RFP feed — separate spec/plan.
- Per-rep signals (rep-specific pipeline filtering happens at query time via a join to `opportunities`, not as denormalized columns).
- Service junction table linking RFPs to specific `Service` rows — reconsidered after we see how reps use keyword + relevance filtering.
- Embedding-based similarity search ("RFPs similar to a deal we won") — would require pgvector; defer.
- Award/win-history ingest — already deferred in Phase 1.

## Schema Changes

Append to the `Rfp` model in `prisma/schema.prisma`:

```prisma
// Classification — set by Haiku classifier pass. Null until classified.
fullmindRelevance     String?    @map("fullmind_relevance")    @db.VarChar(10)  // 'high'|'medium'|'low'|'none'
keywords              String[]   @default([])                  @db.VarChar(80)
fundingSources        String[]   @default([])                  @map("funding_sources") @db.VarChar(40)
setAsideType          String?    @map("set_aside_type")        @db.VarChar(20)
inStateOnly           Boolean    @default(false)               @map("in_state_only")
cooperativeEligible   Boolean    @default(false)               @map("cooperative_eligible")
requiresW9State       String?    @map("requires_w9_state")     @db.VarChar(2)
classifiedAt          DateTime?  @map("classified_at")         @db.Timestamptz

// District pipeline signal — set by nightly refresh job. Null until refreshed.
districtPipelineState String?    @map("district_pipeline_state") @db.VarChar(20)
signalsRefreshedAt    DateTime?  @map("signals_refreshed_at")  @db.Timestamptz
```

Indexes:
```prisma
@@index([fullmindRelevance, dueDate])
@@index([classifiedAt])           // unclassified backlog scan
@@index([signalsRefreshedAt])     // stale-signal scan
```

### Migration (hand-written SQL — Phase 1 deployment learning)

```sql
-- migration: add_rfp_classification_fields
ALTER TABLE rfps
  ADD COLUMN fullmind_relevance       varchar(10),
  ADD COLUMN keywords                 varchar(80)[]  NOT NULL DEFAULT '{}',
  ADD COLUMN funding_sources          varchar(40)[]  NOT NULL DEFAULT '{}',
  ADD COLUMN set_aside_type           varchar(20),
  ADD COLUMN in_state_only            boolean        NOT NULL DEFAULT false,
  ADD COLUMN cooperative_eligible     boolean        NOT NULL DEFAULT false,
  ADD COLUMN requires_w9_state        varchar(2),
  ADD COLUMN classified_at            timestamptz,
  ADD COLUMN district_pipeline_state  varchar(20),
  ADD COLUMN signals_refreshed_at     timestamptz;

ALTER TABLE rfps
  ADD CONSTRAINT rfps_fullmind_relevance_check
    CHECK (fullmind_relevance IS NULL
           OR fullmind_relevance IN ('high','medium','low','none')),
  ADD CONSTRAINT rfps_set_aside_type_check
    CHECK (set_aside_type IS NULL
           OR set_aside_type IN ('small_business','minority_owned','woman_owned',
                                 'veteran_owned','hub_zone','none')),
  ADD CONSTRAINT rfps_district_pipeline_state_check
    CHECK (district_pipeline_state IS NULL
           OR district_pipeline_state IN ('active','recently_won','recently_lost',
                                          'top_icp','cold'));

CREATE INDEX rfps_fullmind_relevance_due_date_idx
  ON rfps (fullmind_relevance, due_date);
CREATE INDEX rfps_classified_at_idx     ON rfps (classified_at);
CREATE INDEX rfps_signals_refreshed_at_idx ON rfps (signals_refreshed_at);
```

No data migration needed — defaults handle existing rows. Backfill happens via the classifier and signal-refresh scripts.

## Classifier — `src/features/rfps/lib/classifier.ts`

Mirrors `src/features/news/lib/classifier.ts` almost 1:1. Same `PQueue` concurrency cap, same Haiku model, same `parseClassificationResult` pure parser pulled out for unit testing, same idempotent batch shape.

### Tool definition

```ts
const CLASSIFY_TOOL = {
  name: "classify_rfp",
  description:
    "Classify a K-12 RFP for Fullmind's sales team: relevance, keywords, disqualifier flags, and funding source tags.",
  input_schema: {
    type: "object",
    properties: {
      fullmindRelevance: {
        type: "string",
        enum: ["high", "medium", "low", "none"],
        description: "Topical fit to Fullmind's services. See rubric.",
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 10 distinctive phrases (lowercase, ~2-4 words each). Include service/program names, grade bands, funding hints, and modality cues. Skip generic terms like 'school' or 'students'.",
      },
      fundingSources: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "esser", "title_i", "title_iv", "idea", "21st_cclc",
            "state_general", "state_intervention", "private_grant",
            "cooperative_purchasing", "unspecified",
          ],
        },
        description:
          "Funding mentioned in the RFP. Use 'unspecified' when the RFP doesn't name a source. Include 'cooperative_purchasing' when the RFP allows piggyback off a cooperative contract.",
      },
      setAsideType: {
        type: "string",
        enum: [
          "small_business", "minority_owned", "woman_owned",
          "veteran_owned", "hub_zone", "none",
        ],
        description:
          "Set-aside requirement. 'none' if the RFP is open to any vendor. Anything other than 'none' or 'small_business' likely disqualifies Fullmind.",
      },
      inStateOnly: {
        type: "boolean",
        description:
          "True if the RFP requires the vendor to be physically located or registered in a specific state.",
      },
      cooperativeEligible: {
        type: "boolean",
        description:
          "True if the RFP allows piggyback off an existing cooperative purchasing agreement (NCPA, Sourcewell, BuyBoard, ESC Region 19, etc.).",
      },
      requiresW9State: {
        type: ["string", "null"],
        pattern: "^[A-Z]{2}$",
        description:
          "USPS code if the RFP requires the vendor to be registered to do business in a specific state, else null.",
      },
    },
    required: [
      "fullmindRelevance", "keywords", "fundingSources",
      "setAsideType", "inStateOnly", "cooperativeEligible",
    ],
  },
} as const;
```

### Relevance rubric (system prompt)

```
RELEVANCE TIERS:

high    — RFP explicitly names a Fullmind modality: tutoring (any kind),
          virtual instruction / WCVI, credit recovery, homebound services,
          suspension alternative, professional development, EK12-style
          curriculum subscription, or hybrid staffing.

medium  — RFP is in an adjacent problem space without naming a Fullmind
          modality directly: MTSS / intervention services, assessment or
          diagnostic tools, summer school programming, generic supplemental
          services, "any qualified vendor for student academic support."

low     — RFP is tangentially K-12 but not Fullmind's problem space:
          library e-resources, generic edtech licenses (LMS, SIS, devices),
          school security/safety, non-instructional staff (custodial, food).

none    — Clearly not Fullmind: HVAC, construction, transportation, food
          service, federal IT contracts, or vendor-only RFPs.

Rate topically — do not factor in deadline tightness or contract value.
Reps compose those filters separately.
```

### Keywords guidance (system prompt)

```
KEYWORDS:
- Up to 10 phrases, lowercase, no punctuation.
- Prefer phrases ('high-dosage tutoring') over single words ('high'/'tutoring').
- Include funding hints when present ('esser', 'title i', '21st cclc').
- Include grade bands when specified ('k-5', 'middle school', 'grades 9-12').
- Include modality cues ('1:3 ratio', 'small group', 'after school',
  'summer', 'remote', 'in-person').
- Include named programs / curricula ('saxon math', 'wilson reading',
  'algebra i', 'imagine learning').
- Skip generic terms: 'school', 'student', 'district', 'education',
  'service', 'program' — they add noise without filtering value.
```

### Disqualifier extraction guidance (system prompt)

```
DISQUALIFIER FLAGS:
- setAsideType: extract literally from the RFP. 'small_business' is fine
  for Fullmind; 'minority_owned' / 'woman_owned' / 'veteran_owned' /
  'hub_zone' usually disqualify Fullmind structurally.
- inStateOnly: true if the RFP requires the vendor to be located or
  incorporated in a specific state. Many state-funded RFPs have this clause.
- cooperativeEligible: true if the RFP says vendors can piggyback on an
  existing cooperative contract (NCPA, Sourcewell, BuyBoard, OMNIA, etc.).
- requiresW9State: USPS code if the RFP requires state-specific tax
  registration. Distinct from inStateOnly — vendor can sometimes register
  remotely.
```

### Idempotency

Same shape as news classifier:
- `WHERE classified_at IS NULL ORDER BY captured_date DESC LIMIT $batchSize`.
- Per-row write inside `Promise.allSettled` to isolate failures.
- Re-running classifies only new RFPs.
- Force-reclassify mode: `--force` flag in the script clears `classified_at` first.

## Cron — `src/app/api/cron/classify-rfps/route.ts`

Mirrors `src/app/api/cron/match-articles/route.ts` (rolling cron, well under Vercel 300s):
- Schedule: every 4 hours.
- Per-run cap: 100 RFPs (max ingest is ~20/day, so this catches up trivially).
- Auth: `authorization: Bearer ${CRON_SECRET}` header.
- Logs: append a row to `rfp_ingest_runs`-style table OR add a counter to existing `rfp_ingest_runs`. Decision: extend `rfp_ingest_runs` with `recordsClassified` to keep telemetry in one place. (See Phase 1 sync counter pattern.)

## Pipeline-signal refresh — `src/features/rfps/lib/refresh-signals.ts`

Computes `district_pipeline_state` per-RFP from current CRM state at `rfps.leaid`.

### Signal definition (priority order — first match wins)

For each RFP with `leaid IS NOT NULL`:

1. **`active`** — there exists an `opportunities` row with `district_lea_id = rfp.leaid` AND `stage NOT IN ('closed_lost','closed_won','disqualified')`.
2. **`recently_won`** — most recent closed-won at this district within 18 months.
3. **`recently_lost`** — most recent closed-lost at this district within 12 months.
4. **`top_icp`** — `district.icp_score` is in the top quartile (>= P75 cutoff computed from `districts` table at refresh time).
5. **`cold`** — none of the above.

For RFPs with `leaid IS NULL`: signal stays NULL (unresolved district can't have pipeline state).

### SQL (one statement, all RFPs at once)

```sql
WITH icp_cutoff AS (
  SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY icp_score) AS p75
  FROM districts WHERE icp_score IS NOT NULL
),
opp_state AS (
  SELECT
    o.district_lea_id AS leaid,
    bool_or(o.stage NOT IN ('closed_lost','closed_won','disqualified'))    AS has_active,
    max(o.close_date) FILTER (WHERE o.stage = 'closed_won')                 AS last_won,
    max(o.close_date) FILTER (WHERE o.stage = 'closed_lost')                AS last_lost
  FROM opportunities o
  WHERE o.district_lea_id IS NOT NULL
  GROUP BY o.district_lea_id
)
UPDATE rfps r
SET
  district_pipeline_state = CASE
    WHEN r.leaid IS NULL THEN NULL
    WHEN COALESCE(s.has_active, false) THEN 'active'
    WHEN s.last_won  >= now() - interval '18 months' THEN 'recently_won'
    WHEN s.last_lost >= now() - interval '12 months' THEN 'recently_lost'
    WHEN d.icp_score >= ic.p75 THEN 'top_icp'
    ELSE 'cold'
  END,
  signals_refreshed_at = now()
FROM icp_cutoff ic
LEFT JOIN districts d  ON d.leaid = r.leaid
LEFT JOIN opp_state s  ON s.leaid = r.leaid
WHERE r.leaid IS NOT NULL;
```

Stage names: verify against the actual `opportunities.stage` distribution before shipping. The Phase 2 spec note about text-stage closed-won detection applies — the `district_opportunity_actuals` matview's stage logic is the canonical reference.

### Cron — `src/app/api/cron/refresh-rfp-signals/route.ts`

- Schedule: nightly at 04:00 UTC (after the opportunities sync completes).
- Auth: same `CRON_SECRET` pattern.
- Telemetry: append to `rfp_ingest_runs` with `kind = 'signal_refresh'` (extend the `source` column to include `'signal_refresh'`, OR add a new `kind` column — recommend the latter).

## Backfill scripts

### `scripts/classify-rfps.ts`
- Loads all RFPs `WHERE classified_at IS NULL`.
- Iterates with `PQueue` (concurrency 4, matching news classifier).
- Logs progress to stdout (every 25 rows).
- Writes per-row inside `Promise.allSettled`.
- Estimated cost for 548-row backfill: well under $1 at Haiku token prices.

### `scripts/refresh-rfp-signals.ts`
- One SQL `UPDATE` for all rows.
- Logs the count by `district_pipeline_state` distribution after.
- Idempotent — safe to re-run.

## Tests

| File | Covers |
|---|---|
| `src/features/rfps/lib/__tests__/classifier.test.ts` (new) | `parseClassificationResult` accepts valid output; rejects bad enum values; truncates `keywords` to 10; coerces `null` `requiresW9State`. End-to-end batch test with mocked Anthropic client. |
| `src/features/rfps/lib/__tests__/refresh-signals.test.ts` (new) | Active opp → `active`. Closed-won < 18mo → `recently_won`. Closed-lost < 12mo → `recently_lost`. ICP top quartile + no opps → `top_icp`. None of above → `cold`. NULL leaid → NULL state. Stage edge cases (text 'closed won' vs numeric stages). |
| `src/app/api/cron/classify-rfps/__tests__/route.test.ts` (new) | Auth required; respects per-run cap; records counter; idempotent on re-run. |
| `src/app/api/cron/refresh-rfp-signals/__tests__/route.test.ts` (new) | Auth required; SQL runs as single statement; records counter. |
| Existing `src/features/rfps/lib/__tests__/sync.test.ts` | Add regression: sync does NOT write to classification fields (decoupled). |

## SEMANTIC_CONTEXT additions

Once the schema lands and at least the backfill runs, register `rfps` in `TABLE_REGISTRY` with the classification columns front-and-center, and add three SEMANTIC_CONTEXT warnings (mirrors the news warnings pattern):

```
RFP DEFAULT FILTERS:
- For "find me RFPs" questions, default to fullmind_relevance IN ('high','medium').
- For "open RFPs", filter due_date >= now().
- For "RFPs at my pipeline districts", filter district_pipeline_state = 'active'.
- Disqualifier: filter set_aside_type IN ('none','small_business') unless the
  rep explicitly asks for set-aside RFPs.
- ESSER seasonal: 'esser' = ANY(funding_sources) AND due_date < '2026-09-30'
  surfaces the federal sunset crunch.

UNCLASSIFIED CAVEAT:
- classified_at IS NULL means the row hasn't been through the classifier.
  Filtering on fullmind_relevance silently drops these. When the rep DOESN'T
  filter on relevance, do not add the filter (you'll undercount). When the
  rep DOES, add a brief caveat that unclassified rows are excluded.

NEVER expose raw IDs (agency_key, leaid, opp_key) to reps — show
agency_name, district name, RFP title.
```

Q&A walkthrough for the column descriptions happens *after* this spec ships and the data is populated.

## States (loading / empty / error)

- **Backfill failure on a single row:** logged, skipped, retried on next cron pass.
- **Whole-batch Haiku failure:** rfp_ingest_runs row marked `status='error'`, error message stored, next cron run retries.
- **Signal refresh on stale opportunities data:** `signals_refreshed_at` exposes how fresh the signals are; query tool can warn "signals last refreshed {ts}" if reps see surprising results.

## Conventions Retained

- snake_case at DB layer, camelCase in Prisma.
- Hand-written SQL migration applied via `prisma db execute` then `prisma migrate resolve --applied`.
- Auth via `CRON_SECRET` Bearer header on cron routes.
- Closure-deferred `vi.mock("@/lib/prisma")` per existing test pattern.
- Many small focused commits per user feedback memory.
- Mirror the news classifier idempotency / batching shape.

## References

- News classifier (mirror): `src/features/news/lib/classifier.ts`
- News matcher cron (mirror): `src/app/api/cron/match-articles/route.ts`
- Phase 1 spec: `Docs/superpowers/specs/2026-05-04-rfp-feed-backend-spec.md`
- Phase 2 spec: `Docs/superpowers/specs/2026-05-04-rfp-feed-agency-district-map-design.md`
- Existing services catalog (relevance rubric reference): `services` table, queried via Prisma.
- Existing TABLE_REGISTRY entry (mirror style): `news_articles` in `src/lib/district-column-metadata.ts`.
