import { extractStates } from "./extract-states";
import { PUBLISHER_STATES } from "./publisher-states.generated";

export interface StateHintInput {
  title: string;
  description: string | null;
  /** news_articles.source — the publisher name */
  publisher: string;
  /**
   * State of the leaid an article is already linked to via a source-confidence
   * row in news_article_districts. Set when an article was discovered through
   * a district-scoped Google News query (Layer 3 / Layer 4 ingest).
   */
  sourceLeaidState?: string | null;
}

/**
 * Combine text-extracted states with two hint sources to produce the
 * stateAbbrevs set the matcher should consider.
 *
 * Hints address the dominant failure mode in production: ~90% of articles
 * have no state name in the title, which gates every pass of
 * `matchArticleKeyword`. The hints recover state from out-of-band signals.
 *
 * Returns a deduplicated, sorted list (sort gives stable test snapshots).
 */
export function computeStateAbbrevs(input: StateHintInput): string[] {
  const text = [input.title, input.description ?? ""].join(" ");
  const set = new Set<string>(extractStates(text));
  if (input.sourceLeaidState) set.add(input.sourceLeaidState);
  const fromPublisher = PUBLISHER_STATES[input.publisher];
  if (fromPublisher) set.add(fromPublisher);
  return [...set].sort();
}
