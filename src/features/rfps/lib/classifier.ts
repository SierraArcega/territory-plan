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
