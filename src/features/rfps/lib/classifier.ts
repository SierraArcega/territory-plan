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
export const MAX_KEYWORD_CHARS = 80;

export interface ClassificationResult {
  fullmindRelevance: Relevance;
  keywords: string[];
  fundingSources: FundingSource[];
  setAsideType: SetAsideType;
  inStateOnly: boolean;
  cooperativeEligible: boolean;
  requiresW9State: string | null;
}

/** Pure parser for the classify_rfp tool's input — pulled out of
 *  classifyOne so it can be unit-tested without mocking the LLM. */
export function parseClassificationResult(raw: unknown): ClassificationResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = raw as Record<string, unknown>;

  const fullmindRelevance = (RELEVANCE_TIERS as readonly string[]).includes(
    (out.fullmindRelevance as string) ?? "",
  )
    ? (out.fullmindRelevance as Relevance)
    : "none";

  const keywords = ((out.keywords as unknown[]) ?? [])
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim().toLowerCase())
    .map((k) => k.slice(0, MAX_KEYWORD_CHARS))
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
    typeof w9 === "string" && /^[a-zA-Z]{2}$/.test(w9.trim())
      ? w9.trim().toUpperCase()
      : null;

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

export interface ClassifyStats {
  processed: number;
  classified: number;
  errors: number;
  llmCalls: number;
}

// PQueue, callClaude, findToolUse, HAIKU_MODEL, and prisma are used in Tasks 4-5
// (classifyOne / classifyMany). Imported here so the skeleton compiles as a unit.

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
    ] as const,
  },
};

const MAX_DESCRIPTION_CHARS = 800;

export interface RfpRow {
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
