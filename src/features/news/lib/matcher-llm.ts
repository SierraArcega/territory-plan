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
    "Classify the scope of a K-12 news article: state-wide vs specific-district. Return only the entities the article is SPECIFICALLY ABOUT, not ones it merely name-collides with.",
  input_schema: {
    type: "object" as const,
    properties: {
      scope: {
        type: "string" as const,
        enum: ["state_wide", "specific_districts", "unrelated"] as const,
        description:
          "state_wide = article discusses state policy, legislation, statewide trends, or multiple districts in a state as a group; specific_districts = article is focused on one or more named specific districts; unrelated = article is not about K-12 education at the district level.",
      },
      confirmedDistricts: {
        type: "array" as const,
        description:
          "LEAIDs of districts the article is genuinely SPECIFICALLY about. Only include when scope=specific_districts AND the article clearly discusses that district's own affairs (its budget, schools, leadership, events). Do NOT include a district just because its name shares a substring with a city or state mentioned (e.g., 'New York' mentions do NOT confirm a district named 'York'; 'Portland' in a Maine-wide story does NOT confirm a district named 'Portland').",
        items: { type: "string" as const },
      },
      confirmedSchools: {
        type: "array" as const,
        description: "NCESSCHs of schools the article is specifically about.",
        items: { type: "string" as const },
      },
      confirmedContacts: {
        type: "array" as const,
        description:
          "IDs of contacts the article is specifically about (named individual being discussed, not just any mention).",
        items: { type: "integer" as const },
      },
    },
    required: ["scope", "confirmedDistricts", "confirmedSchools", "confirmedContacts"] as const,
  },
};

const SYSTEM_PROMPT = `You classify K-12 news article relevance to specific districts, schools, or contacts.

IMPORTANT CONTEXT: You are only given the article TITLE (description is usually a duplicate). You do not see the article body. Do NOT infer facts that aren't in the text you were given.

CRITICAL RULES — follow strictly:

1. EXPLICIT REFERENCE REQUIRED. Only confirm a candidate district if the article text LITERALLY contains EITHER:
     (a) the district's name (or its CRM alias), OR
     (b) the district's city name used in a school-district context (e.g., "Stockton school district", "Stockton Unified passed a bond"), OR
     (c) a school name from that district that's distinctive enough to pin it down.
   Each candidate row includes city= and county= for this reason — use them.

   Generic phrasings like "a New York school district", "Maine school districts", "local school district", "the district" are NOT explicit references to any specific candidate — even if context (mascots, themes, story details) suggests you could guess. You CANNOT guess. Return an empty confirmedDistricts array for these.

2. STATE-WIDE vs SPECIFIC.
     • State-wide = "California school districts", "Maine school leaders", state policy/legislation, trends across a state. Set scope="state_wide", return empty confirmedDistricts.
     • Specific = the article text itself NAMES a particular district (e.g., "Iowa City Community School District announced…", "Anchorage School District's superintendent…"). Set scope="specific_districts".

3. SUBSTRING COLLISIONS are never confirmations.
     • "New York" does NOT confirm a district named "York" or "York Central".
     • Publisher names ("The New York Times", "New York Post") are NOT references to NY districts.
     • "Portland, ME" mentioned as a city does NOT confirm a Maine district named "Portland" — only an explicit reference to "Portland Public Schools" / "Portland School District" does.
     • "Lincoln" could be the city, any of several districts, or the president — require explicit district-level naming.

4. ACRONYMS only count if the acronym is one you recognize maps to that district (CPS for Chicago, LAUSD for Los Angeles Unified, etc.) AND the state is consistent.

5. WHEN IN DOUBT, EXCLUDE. Precision matters more than recall. An empty confirmedDistricts is the correct answer for the majority of K-12 articles. You are being evaluated on false-positive rate, not coverage.

Call the classify_mentions tool with your decision.`;

interface ClassifyOutput {
  scope?: "state_wide" | "specific_districts" | "unrelated";
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
          .map((d) => {
            const parts = [
              `leaid=${d.leaid}`,
              `name="${d.name}"`,
              `state=${d.stateAbbrev ?? "?"}`,
            ];
            if (d.cityLocation) parts.push(`city="${d.cityLocation}"`);
            if (d.countyName) parts.push(`county="${d.countyName}"`);
            if (d.accountName && d.accountName !== d.name) parts.push(`crm_name="${d.accountName}"`);
            return `  - ${parts.join(" ")}`;
          })
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
    systemPrompt: SYSTEM_PROMPT,
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
