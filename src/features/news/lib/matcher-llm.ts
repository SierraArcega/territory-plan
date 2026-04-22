import { callClaude, findToolUse, HAIKU_MODEL } from "@/lib/anthropic";
import type { DistrictCandidate, SchoolCandidate, ContactCandidate } from "./matcher-keyword";

export interface LlmCandidates {
  districts: DistrictCandidate[];
  schools: SchoolCandidate[];
  contacts: ContactCandidate[];
}

export interface LlmMatchResult {
  confirmedDistricts: Array<{ leaid: string; confidence: "llm" }>;
  confirmedSchools: Array<{ ncessch: string; confidence: "llm" }>;
  confirmedContacts: Array<{ contactId: number; confidence: "llm" }>;
  llmCalls: number;
}

const CLASSIFY_TOOL = {
  name: "classify_mentions",
  description:
    "Return which of the provided districts, schools, and contacts are actually the subject of the article. Only include an entity if the article is clearly about it, not just mentions it in passing.",
  input_schema: {
    type: "object" as const,
    properties: {
      confirmedDistricts: {
        type: "array" as const,
        description: "LEAIDs of districts the article is genuinely about.",
        items: { type: "string" as const },
      },
      confirmedSchools: {
        type: "array" as const,
        description: "NCESSCHs of schools the article is genuinely about.",
        items: { type: "string" as const },
      },
      confirmedContacts: {
        type: "array" as const,
        description: "IDs of contacts the article is genuinely about.",
        items: { type: "integer" as const },
      },
    },
    required: ["confirmedDistricts", "confirmedSchools", "confirmedContacts"] as const,
  },
};

interface ClassifyOutput {
  confirmedDistricts?: string[];
  confirmedSchools?: string[];
  confirmedContacts?: number[];
}

/**
 * LLM kill switch — when NEWS_LLM_ENABLED is "false", this returns an empty
 * result without making an API call. Ambiguous candidates stay queued.
 */
export async function matchArticleLLM(
  article: { title: string; description: string | null },
  candidates: LlmCandidates
): Promise<LlmMatchResult> {
  const empty: LlmMatchResult = {
    confirmedDistricts: [],
    confirmedSchools: [],
    confirmedContacts: [],
    llmCalls: 0,
  };

  if (process.env.NEWS_LLM_ENABLED === "false") return empty;
  if (
    candidates.districts.length === 0 &&
    candidates.schools.length === 0 &&
    candidates.contacts.length === 0
  ) {
    return empty;
  }

  const summary = [
    `Title: ${article.title}`,
    article.description ? `Description: ${article.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const candidatesDesc = [
    candidates.districts.length > 0
      ? `Districts:\n${candidates.districts
          .map((d) => `  - leaid=${d.leaid} name="${d.name}" state=${d.stateAbbrev ?? "?"}`)
          .join("\n")}`
      : null,
    candidates.schools.length > 0
      ? `Schools:\n${candidates.schools
          .map((s) => `  - ncessch=${s.ncessch} name="${s.schoolName}" leaid=${s.leaid}`)
          .join("\n")}`
      : null,
    candidates.contacts.length > 0
      ? `Contacts:\n${candidates.contacts
          .map((c) => `  - id=${c.id} name="${c.name}" title="${c.title ?? ""}" leaid=${c.leaid}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const userMessage = `Article:\n${summary}\n\nCandidate entities:\n${candidatesDesc}\n\nReturn only entities the article is genuinely about.`;

  const content = await callClaude({
    model: HAIKU_MODEL,
    systemPrompt:
      "You classify which entities (school districts, schools, or contacts) a K-12 news article is actually about. Be strict — only include entities the article clearly discusses, not passing references.",
    userMessage,
    tools: [CLASSIFY_TOOL],
    toolChoice: { type: "tool", name: "classify_mentions" },
    maxTokens: 1024,
  });

  const tool = findToolUse(content, "classify_mentions");
  if (!tool) return { ...empty, llmCalls: 1 };

  const out = tool.input as unknown as ClassifyOutput;
  const validLeaids = new Set(candidates.districts.map((d) => d.leaid));
  const validNcessch = new Set(candidates.schools.map((s) => s.ncessch));
  const validContacts = new Set(candidates.contacts.map((c) => c.id));

  return {
    confirmedDistricts: (out.confirmedDistricts ?? [])
      .filter((l) => typeof l === "string" && validLeaids.has(l))
      .map((leaid) => ({ leaid, confidence: "llm" as const })),
    confirmedSchools: (out.confirmedSchools ?? [])
      .filter((n) => typeof n === "string" && validNcessch.has(n))
      .map((ncessch) => ({ ncessch, confidence: "llm" as const })),
    confirmedContacts: (out.confirmedContacts ?? [])
      .filter((id) => typeof id === "number" && validContacts.has(id))
      .map((contactId) => ({ contactId, confidence: "llm" as const })),
    llmCalls: 1,
  };
}
