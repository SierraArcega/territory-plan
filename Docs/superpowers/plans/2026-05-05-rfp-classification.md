# RFP Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Annotate every RFP with topical relevance, extracted keywords, structurally-disqualifying flags, funding-source tags, and a district-level pipeline signal — so the rep-facing feed and query tool can filter to "RFPs that are biddable, in-budget, and at districts with heat."

**Architecture:** Mirror the news classifier pattern (`src/features/news/lib/classifier.ts`). Haiku-backed LLM pass writes per-RFP classification fields; a separate nightly SQL job updates the pipeline-signal column from `opportunities` and `districts`. Both run as Vercel crons, decoupled from the existing RFP sync so ingest stays fast.

**Tech Stack:** Prisma + PostgreSQL, `@/lib/anthropic` (Haiku), `p-queue`, Next.js App Router, Vitest with `vi.mock("@/lib/prisma")`. Spec: `Docs/superpowers/specs/2026-05-05-rfp-classification.md`.

**Spec gate before Task 1:** Read the spec end-to-end. Pay attention to:
- The relevance rubric (4-tier, topical-only).
- The disqualifier flag definitions.
- The pipeline-signal priority order (`active` > `recently_won` > `recently_lost` > `top_icp` > `cold`).
- The verified `opportunities.stage` text strings: closed-won = `lower(stage) IN ('closed won', 'active', 'position purchased', 'requisition received', 'return position pending')`; closed-lost = `lower(stage) = 'closed lost'`. Source: `pg_get_viewdef('district_opportunity_actuals')`.

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add 10 fields to `Rfp`, 3 indexes |
| `prisma/migrations/<ts>_rfp_classification/migration.sql` | Create | Hand-written SQL — Phase 1 learning |
| `src/features/rfps/lib/classifier.ts` | Create | Haiku classifier, parser, batch runner |
| `src/features/rfps/lib/__tests__/classifier.test.ts` | Create | Parser unit tests + batch test with mocked Anthropic |
| `src/features/rfps/lib/refresh-signals.ts` | Create | Pipeline-signal SQL update |
| `src/features/rfps/lib/__tests__/refresh-signals.test.ts` | Create | Per-signal-state behavior tests |
| `src/app/api/cron/classify-rfps/route.ts` | Create | Cron entry point |
| `src/app/api/cron/refresh-rfp-signals/route.ts` | Create | Cron entry point |
| `src/features/rfps/lib/__tests__/sync.test.ts` | Modify | Add regression: sync does not touch classification fields |
| `scripts/classify-rfps.ts` | Create | One-shot backfill driver |
| `scripts/refresh-rfp-signals.ts` | Create | One-shot signal refresh driver |
| `vercel.json` | Modify | Add the two new cron schedules |

No frontend files touched. UI work scoped in a follow-up spec.

---

## Task 1: Schema migration

**Files:**
- Create: `prisma/migrations/<timestamp>_rfp_classification/migration.sql`
- Modify: `prisma/schema.prisma:1933-1999` (`Rfp` model)

- [ ] **Step 1: Create the migration directory**

```bash
TS=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_rfp_classification"
```

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/<timestamp>_rfp_classification/migration.sql`:

```sql
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
CREATE INDEX rfps_classified_at_idx       ON rfps (classified_at);
CREATE INDEX rfps_signals_refreshed_at_idx ON rfps (signals_refreshed_at);
```

- [ ] **Step 3: Apply the migration to local DB**

```bash
npx prisma db execute --file prisma/migrations/<timestamp>_rfp_classification/migration.sql --schema prisma/schema.prisma
```

Expected: no output, exit code 0. If it errors with a column-already-exists message, the migration ran twice — verify `\d rfps` and skip to step 5.

- [ ] **Step 4: Mark migration applied in `_prisma_migrations`**

```bash
npx prisma migrate resolve --applied <timestamp>_rfp_classification
```

Expected: `Migration <timestamp>_rfp_classification marked as applied.`

- [ ] **Step 5: Update `Rfp` model in `prisma/schema.prisma`**

Find the `Rfp` model (line ~1933) and add the new fields just before the `// Lifecycle` block. Insert after the `// Links` block (before `status`):

```prisma
  // Classification — set by Haiku classifier pass. Null until classified.
  fullmindRelevance     String?    @map("fullmind_relevance")    @db.VarChar(10)
  keywords              String[]   @default([])                  @db.VarChar(80)
  fundingSources        String[]   @default([])                  @map("funding_sources") @db.VarChar(40)
  setAsideType          String?    @map("set_aside_type")        @db.VarChar(20)
  inStateOnly           Boolean    @default(false)               @map("in_state_only")
  cooperativeEligible   Boolean    @default(false)               @map("cooperative_eligible")
  requiresW9State       String?    @map("requires_w9_state")     @db.VarChar(2)
  classifiedAt          DateTime?  @map("classified_at")         @db.Timestamptz

  // Pipeline signal — set by nightly refresh job. Null until refreshed.
  districtPipelineState String?    @map("district_pipeline_state") @db.VarChar(20)
  signalsRefreshedAt    DateTime?  @map("signals_refreshed_at")   @db.Timestamptz

```

Then add three new index lines to the existing `@@index` block:

```prisma
  @@index([fullmindRelevance, dueDate])
  @@index([classifiedAt])
  @@index([signalsRefreshedAt])
```

- [ ] **Step 6: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client` line. No errors.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If errors mention `Rfp.fullmindRelevance`, the generate didn't run.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/<timestamp>_rfp_classification/
git commit -m "$(cat <<'EOF'
feat(rfps): schema for RFP classification — relevance, keywords, disqualifiers, pipeline signal

Adds 10 fields to rfps:
- fullmind_relevance, keywords, funding_sources, set_aside_type,
  in_state_only, cooperative_eligible, requires_w9_state, classified_at
  (set by the Haiku classifier pass — see Phase 3 spec)
- district_pipeline_state, signals_refreshed_at
  (set by the nightly signal refresh job — derived from opportunities + districts)

Hand-written SQL migration applied via prisma db execute then
migrate resolve --applied (per Phase 1 deployment learning).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Classifier module — pure parser (TDD)

**Files:**
- Create: `src/features/rfps/lib/classifier.ts`
- Create: `src/features/rfps/lib/__tests__/classifier.test.ts`

- [ ] **Step 1: Create classifier.ts skeleton with constants only**

```ts
// src/features/rfps/lib/classifier.ts
import PQueue from "p-queue";
import { callClaude, findToolUse, HAIKU_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

export const RELEVANCE_TIERS = ["high", "medium", "low", "none"] as const;
export type Relevance = (typeof RELEVANCE_TIERS)[number];

export const FUNDING_SOURCES = [
  "esser",
  "title_i",
  "title_iv",
  "idea",
  "21st_cclc",
  "state_general",
  "state_intervention",
  "private_grant",
  "cooperative_purchasing",
  "unspecified",
] as const;
export type FundingSource = (typeof FUNDING_SOURCES)[number];

export const SET_ASIDE_TYPES = [
  "small_business",
  "minority_owned",
  "woman_owned",
  "veteran_owned",
  "hub_zone",
  "none",
] as const;
export type SetAsideType = (typeof SET_ASIDE_TYPES)[number];

export const MAX_KEYWORDS = 10;

export interface ClassificationResult {
  fullmindRelevance: Relevance;
  keywords: string[];
  fundingSources: FundingSource[];
  setAsideType: SetAsideType;
  inStateOnly: boolean;
  cooperativeEligible: boolean;
  requiresW9State: string | null;
}

export function parseClassificationResult(raw: unknown): ClassificationResult | null {
  // implemented in Step 3 — for now, return null so the test compiles
  return null;
}
```

- [ ] **Step 2: Write parser unit tests (RED)**

Create `src/features/rfps/lib/__tests__/classifier.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseClassificationResult, MAX_KEYWORDS } from "../classifier";

describe("parseClassificationResult", () => {
  it("returns null for non-object input", () => {
    expect(parseClassificationResult(null)).toBeNull();
    expect(parseClassificationResult(undefined)).toBeNull();
    expect(parseClassificationResult("string")).toBeNull();
    expect(parseClassificationResult(42)).toBeNull();
  });

  it("parses a valid full result", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: ["high-dosage tutoring", "algebra i", "esser"],
      fundingSources: ["esser", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: true,
      requiresW9State: null,
    });

    expect(result).toEqual({
      fullmindRelevance: "high",
      keywords: ["high-dosage tutoring", "algebra i", "esser"],
      fundingSources: ["esser", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: true,
      requiresW9State: null,
    });
  });

  it("falls back to 'none' for invalid relevance tier", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "super_high", // not in enum
      keywords: [],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.fullmindRelevance).toBe("none");
  });

  it("falls back to 'none' for invalid set-aside type", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: [],
      fundingSources: [],
      setAsideType: "extraterrestrial_owned",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.setAsideType).toBe("none");
  });

  it("filters out invalid funding sources", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: [],
      fundingSources: ["esser", "made_up_source", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.fundingSources).toEqual(["esser", "title_i"]);
  });

  it(`truncates keywords beyond MAX_KEYWORDS (${MAX_KEYWORDS})`, () => {
    const tooMany = Array.from({ length: 25 }, (_, i) => `keyword-${i}`);
    const result = parseClassificationResult({
      fullmindRelevance: "medium",
      keywords: tooMany,
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toHaveLength(MAX_KEYWORDS);
    expect(result?.keywords[0]).toBe("keyword-0");
  });

  it("lowercases and trims keywords", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: ["  High-Dosage Tutoring  ", "ALGEBRA I"],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toEqual(["high-dosage tutoring", "algebra i"]);
  });

  it("filters out empty keywords", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: ["valid", "", "  ", "another"],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toEqual(["valid", "another"]);
  });

  it("validates requiresW9State as 2-letter USPS code or null", () => {
    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "TX",
      })?.requiresW9State,
    ).toBe("TX");

    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "Texas", // bad format
      })?.requiresW9State,
    ).toBeNull();

    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: false,
        // omitted entirely
      })?.requiresW9State,
    ).toBeNull();
  });

  it("coerces missing booleans to false", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: [],
      fundingSources: [],
      setAsideType: "none",
      // inStateOnly + cooperativeEligible omitted
    });
    expect(result?.inStateOnly).toBe(false);
    expect(result?.cooperativeEligible).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests — verify they FAIL**

```bash
npx vitest run src/features/rfps/lib/__tests__/classifier.test.ts
```

Expected: 9 failing tests (all comparing against `null`). The "returns null for non-object input" test passes; the others fail because the stub always returns null.

- [ ] **Step 4: Implement `parseClassificationResult`**

Replace the stub in `src/features/rfps/lib/classifier.ts`:

```ts
export function parseClassificationResult(raw: unknown): ClassificationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const out = raw as Record<string, unknown>;

  const fullmindRelevance = (RELEVANCE_TIERS as readonly string[]).includes(
    (out.fullmindRelevance as string) ?? "",
  )
    ? (out.fullmindRelevance as Relevance)
    : "none";

  const keywords = ((out.keywords as unknown[]) ?? [])
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0)
    .slice(0, MAX_KEYWORDS);

  const fundingSources = ((out.fundingSources as unknown[]) ?? []).filter(
    (s): s is FundingSource =>
      typeof s === "string" && (FUNDING_SOURCES as readonly string[]).includes(s),
  );

  const setAsideType = (SET_ASIDE_TYPES as readonly string[]).includes(
    (out.setAsideType as string) ?? "",
  )
    ? (out.setAsideType as SetAsideType)
    : "none";

  const inStateOnly = out.inStateOnly === true;
  const cooperativeEligible = out.cooperativeEligible === true;

  const w9 = out.requiresW9State;
  const requiresW9State =
    typeof w9 === "string" && /^[A-Z]{2}$/.test(w9) ? w9 : null;

  return {
    fullmindRelevance,
    keywords,
    fundingSources,
    setAsideType,
    inStateOnly,
    cooperativeEligible,
    requiresW9State,
  };
}
```

- [ ] **Step 5: Run the tests — verify they PASS**

```bash
npx vitest run src/features/rfps/lib/__tests__/classifier.test.ts
```

Expected: all 10 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/rfps/lib/classifier.ts src/features/rfps/lib/__tests__/classifier.test.ts
git commit -m "$(cat <<'EOF'
feat(rfps): classifier — pure parser for Haiku tool output

parseClassificationResult is the seam between the Anthropic SDK and
the database. Pulled out so it can be unit-tested without mocking
the LLM. Validates enum membership, caps keyword count, normalizes
case/whitespace, and coerces optional booleans to defaults.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Classifier — tool definition + system prompt

**Files:**
- Modify: `src/features/rfps/lib/classifier.ts`

This task adds string constants and one helper. No tests — these are configuration values consumed by `classifyOne` in Task 4.

- [ ] **Step 1: Add `CLASSIFY_TOOL` and `SYSTEM_PROMPT` constants**

Append to `src/features/rfps/lib/classifier.ts` (after `parseClassificationResult`):

```ts
const CLASSIFY_TOOL = {
  name: "classify_rfp",
  description:
    "Classify a K-12 procurement RFP for Fullmind's sales team: relevance to Fullmind's services, distinctive keywords, structurally-disqualifying flags, and funding source tags.",
  input_schema: {
    type: "object" as const,
    properties: {
      fullmindRelevance: {
        type: "string" as const,
        enum: RELEVANCE_TIERS as unknown as string[],
        description: "Topical fit to Fullmind's services. See rubric in system prompt.",
      },
      keywords: {
        type: "array" as const,
        items: { type: "string" as const },
        description:
          `Up to ${MAX_KEYWORDS} distinctive phrases (lowercase, ~2-4 words each). Include service/program names, grade bands, funding hints, and modality cues. Skip generic terms like 'school' or 'students'.`,
      },
      fundingSources: {
        type: "array" as const,
        items: {
          type: "string" as const,
          enum: FUNDING_SOURCES as unknown as string[],
        },
        description:
          "Funding mentioned in the RFP. Use 'unspecified' when the RFP doesn't name a source. Include 'cooperative_purchasing' when the RFP allows piggyback off a cooperative contract.",
      },
      setAsideType: {
        type: "string" as const,
        enum: SET_ASIDE_TYPES as unknown as string[],
        description:
          "Set-aside requirement. 'none' if open to any vendor. Anything other than 'none' or 'small_business' likely disqualifies Fullmind structurally.",
      },
      inStateOnly: {
        type: "boolean" as const,
        description:
          "True if the RFP requires the vendor to be physically located or registered in a specific state.",
      },
      cooperativeEligible: {
        type: "boolean" as const,
        description:
          "True if the RFP allows piggyback off an existing cooperative purchasing agreement (NCPA, Sourcewell, BuyBoard, OMNIA, ESC Region 19, etc.).",
      },
      requiresW9State: {
        type: ["string", "null"] as unknown as "string",
        description:
          "USPS 2-letter code (e.g. 'TX') if the RFP requires the vendor to be registered to do business in a specific state, else null.",
      },
    },
    required: [
      "fullmindRelevance",
      "keywords",
      "fundingSources",
      "setAsideType",
      "inStateOnly",
      "cooperativeEligible",
    ] as unknown as string[],
  },
};

const SYSTEM_PROMPT = `You classify K-12 procurement RFPs for Fullmind Learning — a company that sells on-demand online tutoring, virtual teachers, intervention services, professional development, and the EK12 curriculum subscription to public school districts.

Each RFP arrives as a title (sometimes with a description and AI summary). The audience is a Fullmind sales rep deciding whether to pursue a bid. You must return:
1. fullmindRelevance: 4-tier topical fit
2. keywords: up to ${MAX_KEYWORDS} distinctive phrases for search/audit
3. fundingSources: structured funding tags
4. setAsideType: structural disqualifier signal
5. inStateOnly + cooperativeEligible + requiresW9State: bid-readiness flags

RELEVANCE TIERS (topical only — do not factor in deadline or contract value):

  HIGH — RFP explicitly names a Fullmind modality:
    • Tutoring (any kind — high-dosage, small group, 1:1, peer, after-school)
    • Virtual instruction / Whole Class Virtual Instruction (WCVI)
    • Credit recovery
    • Homebound services (medical, suspension, general)
    • Suspension alternative programs
    • Hybrid staffing / contract teachers
    • Professional development for teachers
    • EK12-style curriculum subscription (Tier 1, Diverse Learning, Enrichment, Supplemental)

  MEDIUM — adjacent problem space without naming a Fullmind modality:
    • MTSS / intervention services without specified modality
    • Assessment / diagnostic tools
    • Summer school / extended learning programming
    • Generic "supplemental services" or "qualified vendor for academic support"
    • SPED-adjacent academic support without named modality

  LOW — tangentially K-12 but not Fullmind's problem space:
    • Library e-resources
    • Generic edtech platform licenses (LMS, SIS, devices)
    • School security / safety
    • Non-instructional staff (custodial, food, transport)

  NONE — clearly not Fullmind:
    • HVAC, construction, transportation, food service
    • Federal IT contracts
    • Vendor-only RFPs (vendor pre-qualification, not a service procurement)

Default tendency: lean MEDIUM over LOW when uncertain. Reps prefer skimming a few medium RFPs to missing one real signal.

KEYWORDS (up to ${MAX_KEYWORDS}):
  • Lowercase, no punctuation.
  • Phrases preferred over single words ('high-dosage tutoring', not 'high'/'dosage'/'tutoring').
  • Include funding hints when present ('esser', 'title i', '21st cclc').
  • Include grade bands ('k-5', 'middle school', 'grades 9-12').
  • Include modality cues ('1:3 ratio', 'small group', 'after school', 'summer', 'remote').
  • Include named programs / curricula ('saxon math', 'wilson reading', 'algebra i', 'imagine learning').
  • Skip generic terms: 'school', 'student', 'district', 'education', 'service', 'program'.

DISQUALIFIER FLAGS:
  • setAsideType: extract literally. 'small_business' is fine for Fullmind; 'minority_owned' / 'woman_owned' / 'veteran_owned' / 'hub_zone' usually disqualify Fullmind structurally.
  • inStateOnly: true if the RFP requires the vendor to be located or incorporated in a specific state.
  • cooperativeEligible: true if the RFP says vendors can piggyback on an existing cooperative contract.
  • requiresW9State: USPS code if the RFP requires state-specific tax registration. Distinct from inStateOnly — vendor can sometimes register remotely.

Call the classify_rfp tool with your decision.`;
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/rfps/lib/classifier.ts
git commit -m "$(cat <<'EOF'
feat(rfps): classifier tool definition + system prompt

CLASSIFY_TOOL describes the tool input schema for the Haiku call.
SYSTEM_PROMPT contains the full relevance rubric, keyword guidance,
and disqualifier extraction rules — locked from the Phase 3 spec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Classifier — `classifyOne` (TDD)

**Files:**
- Modify: `src/features/rfps/lib/classifier.ts`
- Modify: `src/features/rfps/lib/__tests__/classifier.test.ts`

`classifyOne` calls Haiku via `callClaude`, extracts the tool use, and runs it through `parseClassificationResult`. It does NOT write to the DB — that's `classifyMany`'s responsibility.

- [ ] **Step 1: Add `classifyOne` test (RED)**

Append to `src/features/rfps/lib/__tests__/classifier.test.ts`:

```ts
import { vi } from "vitest";

vi.mock("@/lib/anthropic", () => ({
  HAIKU_MODEL: "claude-haiku-4-5-20251001",
  callClaude: vi.fn(),
  findToolUse: vi.fn(),
}));

import { callClaude, findToolUse } from "@/lib/anthropic";
import { classifyOne } from "../classifier";

describe("classifyOne", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RFP_LLM_ENABLED;
  });

  it("returns null when RFP_LLM_ENABLED='false'", async () => {
    process.env.RFP_LLM_ENABLED = "false";
    const result = await classifyOne({
      id: 42,
      title: "Tutoring services",
      description: null,
      aiSummary: null,
    });
    expect(result).toBeNull();
    expect(callClaude).not.toHaveBeenCalled();
  });

  it("calls callClaude with title/description/aiSummary in the user message", async () => {
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any).mockReturnValue({
      input: {
        fullmindRelevance: "high",
        keywords: ["tutoring"],
        fundingSources: ["esser"],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: true,
      },
    });

    await classifyOne({
      id: 1,
      title: "K-8 High-Dosage Tutoring RFP",
      description: "Seeking vendors for ESSER-funded math tutoring",
      aiSummary: "K-8 ESSER tutoring",
    });

    expect(callClaude).toHaveBeenCalledOnce();
    const arg = (callClaude as any).mock.calls[0][0];
    expect(arg.userMessage).toContain("K-8 High-Dosage Tutoring RFP");
    expect(arg.userMessage).toContain("Seeking vendors for ESSER-funded math tutoring");
    expect(arg.userMessage).toContain("K-8 ESSER tutoring");
    expect(arg.toolChoice).toEqual({ type: "tool", name: "classify_rfp" });
  });

  it("returns null when no classify_rfp tool use found in response", async () => {
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any).mockReturnValue(null);

    const result = await classifyOne({
      id: 1,
      title: "X",
      description: null,
      aiSummary: null,
    });
    expect(result).toBeNull();
  });

  it("parses a successful tool response", async () => {
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any).mockReturnValue({
      input: {
        fullmindRelevance: "medium",
        keywords: ["mtss tier 2"],
        fundingSources: ["title_i"],
        setAsideType: "small_business",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "CA",
      },
    });

    const result = await classifyOne({
      id: 1,
      title: "MTSS Vendor Pool",
      description: null,
      aiSummary: null,
    });

    expect(result).toEqual({
      fullmindRelevance: "medium",
      keywords: ["mtss tier 2"],
      fundingSources: ["title_i"],
      setAsideType: "small_business",
      inStateOnly: true,
      cooperativeEligible: false,
      requiresW9State: "CA",
    });
  });

  it("truncates description to 800 chars to control prompt cost", async () => {
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any).mockReturnValue({
      input: {
        fullmindRelevance: "low",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: false,
      },
    });

    const longDesc = "x".repeat(2000);
    await classifyOne({
      id: 1,
      title: "T",
      description: longDesc,
      aiSummary: null,
    });

    const userMsg = (callClaude as any).mock.calls[0][0].userMessage as string;
    // Should contain at most 800 'x' run from the description
    const xRun = userMsg.match(/x{800,}/);
    expect(xRun).not.toBeNull();
    expect(userMsg.match(/x{900}/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new test — verify it FAILS**

```bash
npx vitest run src/features/rfps/lib/__tests__/classifier.test.ts
```

Expected: 5 new tests fail with `classifyOne is not a function` (or similar import error).

- [ ] **Step 3: Implement `classifyOne`**

Append to `src/features/rfps/lib/classifier.ts`:

```ts
const MAX_DESCRIPTION_CHARS = 800;

interface RfpRow {
  id: number;
  title: string;
  description: string | null;
  aiSummary: string | null;
}

export async function classifyOne(rfp: RfpRow): Promise<ClassificationResult | null> {
  if (process.env.RFP_LLM_ENABLED === "false") return null;

  const parts: string[] = [`Title: ${rfp.title}`];
  if (rfp.description && rfp.description !== rfp.title) {
    parts.push(`Description: ${rfp.description.slice(0, MAX_DESCRIPTION_CHARS)}`);
  }
  if (rfp.aiSummary && rfp.aiSummary !== rfp.title && rfp.aiSummary !== rfp.description) {
    parts.push(`AI Summary: ${rfp.aiSummary.slice(0, MAX_DESCRIPTION_CHARS)}`);
  }
  const userMessage = parts.join("\n");

  const content = await callClaude({
    model: HAIKU_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: [CLASSIFY_TOOL],
    toolChoice: { type: "tool", name: "classify_rfp" },
    maxTokens: 600,
  });

  const tool = findToolUse(content, "classify_rfp");
  if (!tool) return null;

  return parseClassificationResult(tool.input);
}
```

- [ ] **Step 4: Run the test — verify it PASSES**

```bash
npx vitest run src/features/rfps/lib/__tests__/classifier.test.ts
```

Expected: all 15 tests (10 from Task 2 + 5 from Task 4) pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/rfps/lib/classifier.ts src/features/rfps/lib/__tests__/classifier.test.ts
git commit -m "$(cat <<'EOF'
feat(rfps): classifier — classifyOne single-RFP entry point

Calls Haiku via callClaude with the CLASSIFY_TOOL bound, finds the
tool use in the response, and runs it through parseClassificationResult.
Includes title + description + aiSummary in the user message
(deduplicated and truncated to 800 chars each to control prompt cost).

Honors RFP_LLM_ENABLED='false' as a kill-switch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Classifier — batch runner `classifyUnclassified` (TDD)

**Files:**
- Modify: `src/features/rfps/lib/classifier.ts`
- Modify: `src/features/rfps/lib/__tests__/classifier.test.ts`

`classifyUnclassified` is the cron entry point — selects up to N RFPs with `classifiedAt IS NULL`, fans them out through PQueue, and writes results.

- [ ] **Step 1: Add closure-deferred Prisma mock at top of test file**

In `src/features/rfps/lib/__tests__/classifier.test.ts`, add the prisma mock near the top (alongside the existing anthropic mock):

```ts
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rfp: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));
```

- [ ] **Step 2: Add batch tests (RED)**

Append to `src/features/rfps/lib/__tests__/classifier.test.ts`:

```ts
import { classifyUnclassified } from "../classifier";

describe("classifyUnclassified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RFP_LLM_ENABLED;
  });

  it("returns zero stats when RFP_LLM_ENABLED='false'", async () => {
    process.env.RFP_LLM_ENABLED = "false";
    mockFindMany.mockResolvedValue([
      { id: 1, title: "x", description: null, aiSummary: null },
    ]);

    const stats = await classifyUnclassified(10, 2, 5_000);
    expect(stats).toEqual({ processed: 0, classified: 0, errors: 0, llmCalls: 0 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("classifies and writes per-RFP", async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, title: "Tutoring", description: null, aiSummary: null },
      { id: 2, title: "HVAC",     description: null, aiSummary: null },
    ]);
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any)
      .mockReturnValueOnce({
        input: {
          fullmindRelevance: "high",
          keywords: ["tutoring"],
          fundingSources: [],
          setAsideType: "none",
          inStateOnly: false,
          cooperativeEligible: false,
        },
      })
      .mockReturnValueOnce({
        input: {
          fullmindRelevance: "none",
          keywords: ["hvac"],
          fundingSources: [],
          setAsideType: "none",
          inStateOnly: false,
          cooperativeEligible: false,
        },
      });

    const stats = await classifyUnclassified(10, 2, 30_000);

    expect(stats.processed).toBe(2);
    expect(stats.classified).toBe(2);
    expect(stats.errors).toBe(0);
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // Each call must include classifiedAt
    for (const call of mockUpdate.mock.calls) {
      expect(call[0].data.classifiedAt).toBeInstanceOf(Date);
    }
  });

  it("isolates per-RFP errors via Promise.allSettled-equivalent", async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, title: "Good",  description: null, aiSummary: null },
      { id: 2, title: "Bad",   description: null, aiSummary: null },
    ]);

    let call = 0;
    (callClaude as any).mockImplementation(async () => {
      call++;
      if (call === 2) throw new Error("rate limited");
      return [{ type: "text", text: "ok" }];
    });
    (findToolUse as any).mockReturnValue({
      input: {
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: false,
      },
    });

    const stats = await classifyUnclassified(10, 1, 30_000);
    expect(stats.processed).toBe(2);
    expect(stats.classified).toBe(1);
    expect(stats.errors).toBe(1);
  });

  it("respects the limit argument (passes take to findMany)", async () => {
    mockFindMany.mockResolvedValue([]);
    await classifyUnclassified(50, 4, 1_000);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { classifiedAt: null },
        take: 50,
      }),
    );
  });
});
```

- [ ] **Step 3: Run tests — verify they FAIL**

```bash
npx vitest run src/features/rfps/lib/__tests__/classifier.test.ts
```

Expected: 4 new failures, "classifyUnclassified is not a function".

- [ ] **Step 4: Implement `classifyUnclassified` and helpers**

Append to `src/features/rfps/lib/classifier.ts`:

```ts
export interface ClassifyStats {
  processed: number;
  classified: number;
  errors: number;
  llmCalls: number;
}

export async function classifyUnclassified(
  limit = 100,
  concurrency = 4,
  timeBudgetMs = 60_000,
): Promise<ClassifyStats> {
  const stats: ClassifyStats = { processed: 0, classified: 0, errors: 0, llmCalls: 0 };
  if (process.env.RFP_LLM_ENABLED === "false") return stats;

  const rfps = await prisma.rfp.findMany({
    where: { classifiedAt: null },
    select: { id: true, title: true, description: true, aiSummary: true },
    take: limit,
    orderBy: { capturedDate: "desc" },
  });

  return classifyMany(rfps, concurrency, timeBudgetMs, stats);
}

async function classifyMany(
  rfps: RfpRow[],
  concurrency: number,
  timeBudgetMs: number,
  stats: ClassifyStats,
): Promise<ClassifyStats> {
  const deadline = Date.now() + timeBudgetMs;
  const queue = new PQueue({ concurrency });

  for (const r of rfps) {
    queue.add(async () => {
      if (Date.now() > deadline) return;
      stats.processed++;
      try {
        const result = await classifyOne(r);
        stats.llmCalls++;
        if (!result) return;

        await prisma.rfp.update({
          where: { id: r.id },
          data: {
            fullmindRelevance: result.fullmindRelevance,
            keywords: result.keywords,
            fundingSources: result.fundingSources,
            setAsideType: result.setAsideType,
            inStateOnly: result.inStateOnly,
            cooperativeEligible: result.cooperativeEligible,
            requiresW9State: result.requiresW9State,
            classifiedAt: new Date(),
          },
        });
        stats.classified++;
      } catch (err) {
        stats.errors++;
        console.error(`[rfp-classifier] id=${r.id}: ${String(err)}`);
      }
    });
  }
  await queue.onIdle();
  return stats;
}
```

- [ ] **Step 5: Run tests — verify they PASS**

```bash
npx vitest run src/features/rfps/lib/__tests__/classifier.test.ts
```

Expected: all 19 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/rfps/lib/classifier.ts src/features/rfps/lib/__tests__/classifier.test.ts
git commit -m "$(cat <<'EOF'
feat(rfps): classifier — classifyUnclassified batch runner

Selects up to N RFPs with classified_at IS NULL, runs them through
classifyOne with PQueue concurrency, and writes results per-row inside
a try/catch so a single failure doesn't poison the batch. Returns
ClassifyStats for the cron handler to surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Cron route — classify-rfps

**Files:**
- Create: `src/app/api/cron/classify-rfps/route.ts`

Mirrors `src/app/api/cron/classify-news/route.ts` with `Rfp` swapped for `NewsArticle`. No separate test file — the cron is a thin wrapper; coverage comes from `classifyUnclassified` tests in Task 5.

- [ ] **Step 1: Create the cron route**

Create `src/app/api/cron/classify-rfps/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyUnclassified } from "@/features/rfps/lib/classifier";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/classify-rfps
 *
 * Runs the Haiku classifier over any RFPs with `classifiedAt IS NULL`.
 * Time-budgeted; re-invoke until queueRemaining=0 for a full backfill.
 *
 * Query params:
 *   ?batch=N        — max RFPs per invocation (default 100, max 500)
 *   ?concurrency=N  — parallel Haiku calls (default 4)
 *   ?budgetMs=N     — soft time budget (default 250000, max 290000)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batch = Math.min(parseInt(searchParams.get("batch") || "100", 10), 500);
  const concurrency = Math.min(parseInt(searchParams.get("concurrency") || "4", 10), 8);
  const budgetMs = Math.min(
    parseInt(searchParams.get("budgetMs") || "250000", 10),
    290_000,
  );

  const stats = await classifyUnclassified(batch, concurrency, budgetMs);
  const queueRemaining = await prisma.rfp.count({
    where: { classifiedAt: null },
  });

  return NextResponse.json({ ...stats, queueRemaining });
}
```

- [ ] **Step 2: Smoke-test the route locally**

In a separate terminal (server already running on :3005):

```bash
curl -s "http://localhost:3005/api/cron/classify-rfps?secret=$CRON_SECRET&batch=2&concurrency=1" | jq
```

Expected JSON:
```json
{
  "processed": 2,
  "classified": 2,
  "errors": 0,
  "llmCalls": 2,
  "queueRemaining": 546
}
```

(If `RFP_LLM_ENABLED=false`, you'll see all-zeros — check your .env.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/classify-rfps/route.ts
git commit -m "$(cat <<'EOF'
feat(rfps): cron route — classify-rfps

Time-budgeted cron that drains the unclassified backlog. Mirrors
the classify-news route shape; auth via Bearer or ?secret= query
param. Returns batch stats + queueRemaining so we can tell when
the backlog is drained.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Pipeline-signal SQL (TDD)

**Files:**
- Create: `src/features/rfps/lib/refresh-signals.ts`
- Create: `src/features/rfps/lib/__tests__/refresh-signals.test.ts`

This task computes `district_pipeline_state` for every RFP from current `opportunities` + `districts` state. Uses `pg` directly (not Prisma) because the update is a single set-based statement and Prisma's escape hatch is awkward for that shape.

- [ ] **Step 1: Write integration-style test using a test DB transaction**

The signal logic is pure SQL — best tested by inserting fixtures and asserting the resulting `district_pipeline_state`. The repo already has a Postgres test pattern in `src/features/rfps/lib/__tests__/sync.test.ts`; mirror it. Create `src/features/rfps/lib/__tests__/refresh-signals.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { refreshRfpSignals } from "../refresh-signals";

// Use the same connection string as Prisma. Tests run in a transaction
// that ROLLBACKs at the end so they don't leak fixtures.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function withTx<T>(fn: (q: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(async (sql, params) => client.query(sql, params));
    await client.query("ROLLBACK");
    return out;
  } finally {
    client.release();
  }
}

describe("refreshRfpSignals", () => {
  // Each test inserts fixtures + RFPs into a transaction, calls refresh,
  // asserts the resulting signal, and rolls back. We pass the test's
  // pg client to refreshRfpSignals via a poolOverride parameter so the
  // UPDATE runs in the same transaction.

  it("sets 'active' when an open opportunity exists at the district", async () => {
    await withTx(async (q) => {
      // Fixtures
      await q(`INSERT INTO districts (leaid, name, state_fips, state_abbrev) VALUES ($1, $2, $3, $4)`,
        ["TEST001", "Test District 1", "01", "AL"]);
      await q(`INSERT INTO opportunities (id, district_lea_id, stage, name) VALUES ($1, $2, $3, $4)`,
        ["test-opp-1", "TEST001", "2 - Presentation", "Open Deal"]);
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, $6, now(), '{}'::jsonb)`,
        ["test-rfp-1", "T", 999_001, "Test Agency", "AL", "TEST001"]);

      await refreshRfpSignals(q);

      const { rows } = await q(`SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-1'`);
      expect(rows[0].district_pipeline_state).toBe("active");
    });
  });

  it("sets 'recently_won' when a closed-won opportunity is within 18 months and no active deal", async () => {
    await withTx(async (q) => {
      await q(`INSERT INTO districts (leaid, name, state_fips, state_abbrev) VALUES ($1, $2, $3, $4)`,
        ["TEST002", "Test District 2", "01", "AL"]);
      await q(`INSERT INTO opportunities (id, district_lea_id, stage, name, close_date) VALUES ($1, $2, $3, $4, $5)`,
        ["test-opp-2", "TEST002", "Closed Won", "Won Deal", "2025-08-01"]);
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, $6, now(), '{}'::jsonb)`,
        ["test-rfp-2", "T", 999_002, "Test Agency", "AL", "TEST002"]);

      await refreshRfpSignals(q);

      const { rows } = await q(`SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-2'`);
      expect(rows[0].district_pipeline_state).toBe("recently_won");
    });
  });

  it("recognizes text-stage closed-won synonyms", async () => {
    await withTx(async (q) => {
      await q(`INSERT INTO districts (leaid, name, state_fips, state_abbrev) VALUES ($1, $2, $3, $4)`,
        ["TEST003", "Test District 3", "01", "AL"]);
      // 'Active' is a closed-won synonym per district_opportunity_actuals matview
      await q(`INSERT INTO opportunities (id, district_lea_id, stage, name, close_date) VALUES ($1, $2, $3, $4, $5)`,
        ["test-opp-3", "TEST003", "Active", "Won Deal", "2025-08-01"]);
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, $6, now(), '{}'::jsonb)`,
        ["test-rfp-3", "T", 999_003, "Test Agency", "AL", "TEST003"]);

      await refreshRfpSignals(q);

      const { rows } = await q(`SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-3'`);
      expect(rows[0].district_pipeline_state).toBe("recently_won");
    });
  });

  it("sets 'recently_lost' when a closed-lost is within 12 months and nothing more recent", async () => {
    await withTx(async (q) => {
      await q(`INSERT INTO districts (leaid, name, state_fips, state_abbrev) VALUES ($1, $2, $3, $4)`,
        ["TEST004", "Test District 4", "01", "AL"]);
      await q(`INSERT INTO opportunities (id, district_lea_id, stage, name, close_date) VALUES ($1, $2, $3, $4, $5)`,
        ["test-opp-4", "TEST004", "Closed Lost", "Lost Deal", "2025-09-01"]);
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, $6, now(), '{}'::jsonb)`,
        ["test-rfp-4", "T", 999_004, "Test Agency", "AL", "TEST004"]);

      await refreshRfpSignals(q);

      const { rows } = await q(`SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-4'`);
      expect(rows[0].district_pipeline_state).toBe("recently_lost");
    });
  });

  it("active wins over closed-won — both at the same district", async () => {
    await withTx(async (q) => {
      await q(`INSERT INTO districts (leaid, name, state_fips, state_abbrev) VALUES ($1, $2, $3, $4)`,
        ["TEST005", "Test District 5", "01", "AL"]);
      await q(`INSERT INTO opportunities (id, district_lea_id, stage, name, close_date) VALUES ($1, $2, $3, $4, $5)`,
        ["test-opp-5a", "TEST005", "Closed Won", "Won 2024", "2024-09-01"]);
      await q(`INSERT INTO opportunities (id, district_lea_id, stage, name) VALUES ($1, $2, $3, $4)`,
        ["test-opp-5b", "TEST005", "3 - Proposal", "Open 2026"]);
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, $6, now(), '{}'::jsonb)`,
        ["test-rfp-5", "T", 999_005, "Test Agency", "AL", "TEST005"]);

      await refreshRfpSignals(q);

      const { rows } = await q(`SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-5'`);
      expect(rows[0].district_pipeline_state).toBe("active");
    });
  });

  it("sets 'top_icp' for Tier 1 / Tier 2 districts with no opps", async () => {
    await withTx(async (q) => {
      await q(`INSERT INTO districts (leaid, name, state_fips, state_abbrev, icp_tier) VALUES ($1, $2, $3, $4, $5)`,
        ["TEST006", "Top Tier", "01", "AL", "Tier 1"]);
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, $6, now(), '{}'::jsonb)`,
        ["test-rfp-6", "T", 999_006, "Test Agency", "AL", "TEST006"]);

      await refreshRfpSignals(q);

      const { rows } = await q(`SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-6'`);
      expect(rows[0].district_pipeline_state).toBe("top_icp");
    });
  });

  it("sets 'cold' for non-top-tier districts with no opps", async () => {
    await withTx(async (q) => {
      await q(`INSERT INTO districts (leaid, name, state_fips, state_abbrev, icp_tier) VALUES ($1, $2, $3, $4, $5)`,
        ["TEST007", "Cold District", "01", "AL", "Tier 4"]);
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, $6, now(), '{}'::jsonb)`,
        ["test-rfp-7", "T", 999_007, "Test Agency", "AL", "TEST007"]);

      await refreshRfpSignals(q);

      const { rows } = await q(`SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-7'`);
      expect(rows[0].district_pipeline_state).toBe("cold");
    });
  });

  it("leaves district_pipeline_state NULL when leaid is NULL", async () => {
    await withTx(async (q) => {
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, NULL, now(), '{}'::jsonb)`,
        ["test-rfp-8", "T", 999_008, "Test Agency", "AL"]);

      await refreshRfpSignals(q);

      const { rows } = await q(`SELECT district_pipeline_state, signals_refreshed_at FROM rfps WHERE external_id='test-rfp-8'`);
      expect(rows[0].district_pipeline_state).toBeNull();
      expect(rows[0].signals_refreshed_at).toBeNull();
    });
  });

  it("sets signals_refreshed_at on every updated RFP", async () => {
    await withTx(async (q) => {
      await q(`INSERT INTO districts (leaid, name, state_fips, state_abbrev) VALUES ($1, $2, $3, $4)`,
        ["TEST009", "Test 9", "01", "AL"]);
      await q(`INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, raw_payload) VALUES ($1, $1, $2, $3, $4, $5, $6, now(), '{}'::jsonb)`,
        ["test-rfp-9", "T", 999_009, "Test Agency", "AL", "TEST009"]);

      const before = new Date();
      await refreshRfpSignals(q);
      const after = new Date();

      const { rows } = await q(`SELECT signals_refreshed_at FROM rfps WHERE external_id='test-rfp-9'`);
      const ts = new Date(rows[0].signals_refreshed_at);
      expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(ts.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL (module not found)**

```bash
npx vitest run src/features/rfps/lib/__tests__/refresh-signals.test.ts
```

Expected: all 9 tests fail with `Cannot find module '../refresh-signals'`.

- [ ] **Step 3: Implement `refreshRfpSignals`**

Create `src/features/rfps/lib/refresh-signals.ts`:

```ts
import { Pool } from "pg";

let _pool: Pool | undefined;
function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

type Querier = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

const REFRESH_SQL = `
WITH opp_state AS (
  SELECT
    o.district_lea_id AS leaid,
    bool_or(
      lower(o.stage) NOT IN (
        'closed won','closed lost','active','position purchased',
        'requisition received','return position pending',
        'complete - full length','complete - early cancellation',
        'position cancelled'
      )
      AND o.stage IS NOT NULL
    ) AS has_active,
    max(o.close_date) FILTER (
      WHERE lower(o.stage) IN (
        'closed won','active','position purchased',
        'requisition received','return position pending'
      )
    ) AS last_won,
    max(o.close_date) FILTER (
      WHERE lower(o.stage) = 'closed lost'
    ) AS last_lost
  FROM opportunities o
  WHERE o.district_lea_id IS NOT NULL
  GROUP BY o.district_lea_id
)
UPDATE rfps r
SET
  district_pipeline_state = CASE
    WHEN COALESCE(s.has_active, false)                                 THEN 'active'
    WHEN s.last_won  >= now() - interval '18 months'                   THEN 'recently_won'
    WHEN s.last_lost >= now() - interval '12 months'                   THEN 'recently_lost'
    WHEN d.icp_tier IN ('Tier 1', 'Tier 2')                            THEN 'top_icp'
    ELSE 'cold'
  END,
  signals_refreshed_at = now()
FROM districts d
LEFT JOIN opp_state s ON s.leaid = d.leaid
WHERE r.leaid IS NOT NULL
  AND r.leaid = d.leaid;
`;

/**
 * Refresh district_pipeline_state on every RFP with a resolved leaid.
 *
 * @param queryFn Optional override (used by tests to run inside a tx).
 *                If omitted, uses a connection from the module pool.
 * @returns rows updated
 */
export async function refreshRfpSignals(queryFn?: Querier): Promise<number> {
  const q = queryFn ?? ((sql, params) => getPool().query(sql, params));
  const result = await q(REFRESH_SQL);
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npx vitest run src/features/rfps/lib/__tests__/refresh-signals.test.ts
```

Expected: all 9 tests pass.

If the "active wins over closed-won" test fails: the priority CASE order is wrong — `active` MUST be the first branch. Fix order, re-run.

If the "text-stage closed-won synonyms" test fails: the `last_won` filter is missing one of `'active'|'position purchased'|'requisition received'|'return position pending'`. Add it.

- [ ] **Step 5: Commit**

```bash
git add src/features/rfps/lib/refresh-signals.ts src/features/rfps/lib/__tests__/refresh-signals.test.ts
git commit -m "$(cat <<'EOF'
feat(rfps): refresh-signals — district_pipeline_state SQL

One UPDATE statement that derives district_pipeline_state per RFP
from current opportunities + districts state. Priority order:
active > recently_won (<=18mo) > recently_lost (<=12mo) > top_icp
(Tier 1/2) > cold.

Closed-won/closed-lost text-stage detection mirrors the
district_opportunity_actuals matview's canonical predicates
(verified via pg_get_viewdef).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Cron route — refresh-rfp-signals

**Files:**
- Create: `src/app/api/cron/refresh-rfp-signals/route.ts`

- [ ] **Step 1: Create the cron route**

Create `src/app/api/cron/refresh-rfp-signals/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { refreshRfpSignals } from "@/features/rfps/lib/refresh-signals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/refresh-rfp-signals
 *
 * Recomputes district_pipeline_state on every RFP with a resolved leaid.
 * One SQL UPDATE; idempotent. Schedule nightly after the opportunities sync.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const rowsUpdated = await refreshRfpSignals();
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({ rowsUpdated, elapsedMs });
}
```

- [ ] **Step 2: Smoke-test locally**

```bash
curl -s "http://localhost:3005/api/cron/refresh-rfp-signals?secret=$CRON_SECRET" | jq
```

Expected (numbers will vary):
```json
{ "rowsUpdated": 320, "elapsedMs": 180 }
```

- [ ] **Step 3: Verify the signal distribution looks reasonable**

```bash
node -e "require('dotenv').config(); require('dotenv').config({path:'.env.local',override:true}); const {Client}=require('pg'); const c=new Client({connectionString:process.env.DATABASE_URL}); c.connect().then(()=>c.query('SELECT district_pipeline_state, COUNT(*) FROM rfps GROUP BY 1 ORDER BY 2 DESC')).then(r=>{r.rows.forEach(x=>console.log(String(x.count).padStart(4), x.district_pipeline_state||'NULL'));return c.end()})"
```

Expected: a mix of `cold`, `top_icp`, `active`, `recently_won`, `recently_lost`, plus `NULL` for unresolved-leaid RFPs. If everything is `NULL` or only one category fires, something is wrong with the SQL.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/refresh-rfp-signals/route.ts
git commit -m "$(cat <<'EOF'
feat(rfps): cron route — refresh-rfp-signals

Thin wrapper around refreshRfpSignals(). Returns rowsUpdated +
elapsedMs for cron telemetry. Schedule nightly after the opportunities
sync settles (vercel.json update in a later task).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Sync regression test

**Files:**
- Modify: `src/features/rfps/lib/__tests__/sync.test.ts`

Phase 1's `sync.ts` writes RFP rows on ingest. We need a regression test asserting it does NOT touch the new classification fields — those belong only to the classifier and the signal-refresh job.

- [ ] **Step 1: Skim sync.ts to confirm current behavior**

```bash
grep -nE "fullmind_relevance|classified_at|district_pipeline_state|keywords|funding_sources|set_aside_type|in_state_only|cooperative_eligible|requires_w9_state|signals_refreshed_at" src/features/rfps/lib/sync.ts
```

Expected: zero matches. (If anything appears, the regression already exists — fix sync.ts before continuing.)

- [ ] **Step 2: Add a regression test**

Open `src/features/rfps/lib/__tests__/sync.test.ts` and locate the existing test setup (the `vi.mock("@/lib/prisma", ...)` block and the test that asserts a sync write). Append a new test:

```ts
it("does NOT write classification or pipeline-signal fields", async () => {
  // Setup the same fixture as the existing happy-path sync test
  // (see top of file). Then run sync and inspect the prisma.rfp.upsert calls.
  // The classification fields must not appear in any `data` payload.

  const upsertCalls = mockUpsert.mock.calls;
  for (const call of upsertCalls) {
    const data = call[0]?.create ?? call[0]?.update ?? {};
    expect(data).not.toHaveProperty("fullmindRelevance");
    expect(data).not.toHaveProperty("keywords");
    expect(data).not.toHaveProperty("fundingSources");
    expect(data).not.toHaveProperty("setAsideType");
    expect(data).not.toHaveProperty("inStateOnly");
    expect(data).not.toHaveProperty("cooperativeEligible");
    expect(data).not.toHaveProperty("requiresW9State");
    expect(data).not.toHaveProperty("classifiedAt");
    expect(data).not.toHaveProperty("districtPipelineState");
    expect(data).not.toHaveProperty("signalsRefreshedAt");
  }
});
```

If `mockUpsert` isn't already exported from the test setup, add it where the existing prisma mock lives near the top of the file (mirroring the pattern from Task 5 step 1).

- [ ] **Step 3: Run the test — verify it PASSES**

```bash
npx vitest run src/features/rfps/lib/__tests__/sync.test.ts
```

Expected: all sync tests pass, including the new regression.

- [ ] **Step 4: Commit**

```bash
git add src/features/rfps/lib/__tests__/sync.test.ts
git commit -m "$(cat <<'EOF'
test(rfps): regression — sync does not write classification fields

Ingest must stay decoupled from classification. This test pins the
boundary: if a future sync change starts writing fullmind_relevance,
keywords, funding_sources, set_aside_type, classified_at, etc., the
test fails and we have a deliberate decision to make.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Backfill scripts

**Files:**
- Create: `scripts/classify-rfps.ts`
- Create: `scripts/refresh-rfp-signals.ts`

These are one-shot drivers for the existing 548-row backlog. After this lands, the cron handles the steady state.

- [ ] **Step 1: Create the classify backfill script**

Create `scripts/classify-rfps.ts`:

```ts
/**
 * One-shot RFP classification backfill.
 *
 * Usage:
 *   npx tsx scripts/classify-rfps.ts             # classify all WHERE classified_at IS NULL
 *   npx tsx scripts/classify-rfps.ts --force     # re-classify everything (clears classified_at first)
 *   npx tsx scripts/classify-rfps.ts --batch=50  # cap per loop (default 100)
 */
import { prisma } from "@/lib/prisma";
import { classifyUnclassified } from "@/features/rfps/lib/classifier";

const args = process.argv.slice(2);
const force = args.includes("--force");
const batchArg = args.find((a) => a.startsWith("--batch="));
const batchSize = batchArg ? parseInt(batchArg.split("=")[1], 10) : 100;

async function main() {
  if (force) {
    const cleared = await prisma.rfp.updateMany({
      data: { classifiedAt: null },
    });
    console.log(`[force] cleared classified_at on ${cleared.count} rows`);
  }

  let totalClassified = 0;
  let totalErrors = 0;
  let loops = 0;

  while (true) {
    const queueRemaining = await prisma.rfp.count({
      where: { classifiedAt: null },
    });
    if (queueRemaining === 0) break;

    loops++;
    console.log(`[loop ${loops}] queue: ${queueRemaining} remaining`);

    const stats = await classifyUnclassified(batchSize, 4, 60_000);
    totalClassified += stats.classified;
    totalErrors += stats.errors;

    console.log(`[loop ${loops}] classified=${stats.classified} errors=${stats.errors}`);

    if (stats.processed === 0) {
      console.warn("[loop] processed 0 — something is wrong, bailing");
      break;
    }
  }

  console.log(`\nDone. classified=${totalClassified} errors=${totalErrors} loops=${loops}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Create the signal refresh script**

Create `scripts/refresh-rfp-signals.ts`:

```ts
/**
 * One-shot pipeline-signal refresh.
 *
 * Usage:
 *   npx tsx scripts/refresh-rfp-signals.ts
 */
import { prisma } from "@/lib/prisma";
import { refreshRfpSignals } from "@/features/rfps/lib/refresh-signals";

async function main() {
  const startedAt = Date.now();
  const rowsUpdated = await refreshRfpSignals();
  const elapsedMs = Date.now() - startedAt;
  console.log(`Updated ${rowsUpdated} RFPs in ${elapsedMs}ms`);

  // Distribution snapshot — sanity check the result.
  const dist = await prisma.$queryRaw<{ state: string | null; n: bigint }[]>`
    SELECT district_pipeline_state AS state, COUNT(*)::bigint AS n
    FROM rfps
    GROUP BY 1
    ORDER BY 2 DESC
  `;
  console.log("\nSignal distribution:");
  for (const row of dist) {
    console.log(`  ${String(row.state ?? "NULL").padEnd(15)} ${row.n}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Smoke-test the refresh script**

```bash
npx tsx scripts/refresh-rfp-signals.ts
```

Expected output:
```
Updated 320 RFPs in 180ms

Signal distribution:
  cold            265
  top_icp         28
  active          12
  ...
```

- [ ] **Step 4: Commit**

```bash
git add scripts/classify-rfps.ts scripts/refresh-rfp-signals.ts
git commit -m "$(cat <<'EOF'
chore(rfps): backfill scripts for classification and signal refresh

scripts/classify-rfps.ts loops over the unclassified backlog in batches
until empty. --force flag clears classified_at first for a full re-run.

scripts/refresh-rfp-signals.ts is a thin tsx wrapper that runs the
pipeline-signal SQL once and prints the distribution.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Vercel cron schedules

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add the two new cron entries**

Edit `vercel.json`. Inside the existing `crons` array, add:

```json
{
  "path": "/api/cron/classify-rfps?secret=${CRON_SECRET}",
  "schedule": "0 */4 * * *"
},
{
  "path": "/api/cron/refresh-rfp-signals?secret=${CRON_SECRET}",
  "schedule": "0 4 * * *"
}
```

`0 */4 * * *` = every 4 hours on the hour.
`0 4 * * *` = nightly at 04:00 UTC.

- [ ] **Step 2: Verify JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"
```

Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "$(cat <<'EOF'
chore(rfps): cron schedules — classify-rfps every 4h, refresh-rfp-signals nightly

classify-rfps drains the classification backlog in 4-hour windows.
refresh-rfp-signals at 04:00 UTC runs after the opportunities
sync settles, so the pipeline_state column reflects yesterday's
deal movement.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Backfill runbook (manual)

This is a checklist, not code. Run it once after Tasks 1-11 ship.

- [ ] **Step 1: Confirm `RFP_LLM_ENABLED` is unset (or `true`) in `.env.local`**

```bash
grep -i "RFP_LLM_ENABLED" .env.local || echo "(not set — defaults to enabled)"
```

- [ ] **Step 2: Run the classification backfill**

```bash
npx tsx scripts/classify-rfps.ts --batch=100
```

Expected: takes ~5-10 minutes for 548 rows at concurrency 4. Watch for repeated `errors=N` lines — single-digit errors per loop are normal (transient Anthropic rate limits), but if every row in a loop errors, abort and check `RFP_LLM_ENABLED` / `ANTHROPIC_API_KEY`.

- [ ] **Step 3: Run the signal refresh**

```bash
npx tsx scripts/refresh-rfp-signals.ts
```

Expected: prints `Updated <N> RFPs` and the distribution.

- [ ] **Step 4: Spot-check classifications in the DB**

```bash
node -e "require('dotenv').config(); require('dotenv').config({path:'.env.local',override:true}); const {Client}=require('pg'); const c=new Client({connectionString:process.env.DATABASE_URL}); c.connect().then(()=>c.query(\"SELECT title, fullmind_relevance, keywords, district_pipeline_state FROM rfps WHERE fullmind_relevance='high' ORDER BY due_date NULLS LAST LIMIT 10\")).then(r=>{r.rows.forEach(x=>console.log(x.fullmind_relevance.padEnd(7), x.district_pipeline_state?.padEnd(15)||'-'.padEnd(15), x.title.slice(0,80)));return c.end()})"
```

Expected: 10 RFPs where `fullmind_relevance='high'` — titles should plausibly be tutoring/PD/intervention/etc. If you see HVAC RFPs ranked `high`, the system prompt rubric needs tightening — capture the misclassified titles and revisit.

- [ ] **Step 5: Spot-check disqualifier extraction**

```bash
node -e "require('dotenv').config(); require('dotenv').config({path:'.env.local',override:true}); const {Client}=require('pg'); const c=new Client({connectionString:process.env.DATABASE_URL}); c.connect().then(()=>c.query(\"SELECT title, set_aside_type, in_state_only, cooperative_eligible, requires_w9_state FROM rfps WHERE set_aside_type IS NOT NULL AND set_aside_type<>'none' LIMIT 10\")).then(r=>{r.rows.forEach(x=>console.log(x.set_aside_type.padEnd(15), 'in-state:'+x.in_state_only, 'coop:'+x.cooperative_eligible, x.title.slice(0,60)));return c.end()})"
```

Expected: if the 548-RFP corpus contains any set-aside RFPs, they show up here. Reasonable — federal contracting through HigherGov sees lots of small-business and minority-owned set-asides.

- [ ] **Step 6: Manual smoke test of the cron**

```bash
curl -s "http://localhost:3005/api/cron/classify-rfps?secret=$CRON_SECRET" | jq
curl -s "http://localhost:3005/api/cron/refresh-rfp-signals?secret=$CRON_SECRET" | jq
```

Expected: classify returns `queueRemaining: 0` (or close — there may be late-ingested rows). Refresh returns `rowsUpdated: <N>`.

- [ ] **Step 7: Push the branch — Vercel picks up the cron schedules on next deploy**

```bash
git push
```

(Note: pushing this branch updates PR #181 with the full Phase 3 implementation. Confirm this is intended before pushing, or push to a separate branch if Phase 3 should land in its own PR.)

---

## Self-Review Notes (already reconciled before handoff)

- **Spec coverage:** Schema (Task 1), classifier (2-5), classify cron (6), signal SQL (7), signal cron (8), sync regression (9), backfill (10-12), Vercel schedules (11). TABLE_REGISTRY registration is intentionally deferred — see spec.
- **Stage logic:** Verified against `pg_get_viewdef('district_opportunity_actuals')` — the closed-won synonym list and closed-lost predicate match the matview's canonical CASE.
- **ICP cutoff:** Verified `icp_tier IN ('Tier 1','Tier 2')` covers ~4.3K of ~19K districts — meaningful pool, distinct from `cold`.
- **Idempotency:** Classifier is idempotent on `classified_at IS NULL`; signal refresh is fully replaceable (every run rewrites every row).
- **Type consistency:** `RfpRow`, `ClassificationResult`, `ClassifyStats`, `Querier` defined once and used consistently. `MAX_KEYWORDS` referenced in tests + parser + tool description.
