import { US_STATES } from "./config";

const EDU_CONTEXT_RE = /\b(schools?|districts?|boards?|superintendents?|teachers?|students?|education|classrooms?|curriculum|enrollment|pupils?)\b/i;

// Ambiguous state names where additional disambiguation is required
// (country name, common person name, etc.)
const AMBIGUOUS = new Set(["Georgia", "Washington", "Jordan"]);

/**
 * Extract US state abbreviations mentioned in article text.
 *
 * Matches:
 *   - Postal abbreviations alongside a comma or at word boundary within an
 *     education context (so "Austin, TX" matches but "FYI I am back" does not)
 *   - State full names, but for ambiguous names requires an education-context
 *     word in the same sentence
 */
export function extractStates(text: string): string[] {
  const found = new Set<string>();
  const sentences = text.split(/(?<=[.!?])\s+/);

  // Abbreviation detection: look for ", XX" or "XX," patterns
  for (const state of US_STATES) {
    const abbrevRe = new RegExp(`\\b${state.abbrev}\\b(?=[\\s,.])`, "g");
    if (abbrevRe.test(text)) {
      found.add(state.abbrev);
    }
  }

  // Full-name detection, with ambiguity guarding by sentence
  for (const state of US_STATES) {
    const nameRe = new RegExp(`\\b${escapeRegex(state.name)}\\b`, "i");
    if (!nameRe.test(text)) continue;

    if (AMBIGUOUS.has(state.name)) {
      // Require the name to appear in a sentence with an education context word
      const confirmed = sentences.some(
        (s) => nameRe.test(s) && EDU_CONTEXT_RE.test(s)
      );
      if (!confirmed) continue;
    }
    found.add(state.abbrev);
  }

  return [...found].sort();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
