/**
 * Column registry for the opportunity Kanban board.
 *
 * Columns are the real Salesforce opportunity stages (numbered funnel + the two
 * closed outcomes). Matching is exact string equality on `opportunities.stage`;
 * any stage outside this set (staffing "Position …" stages, "Complete …",
 * "Active", null) is intentionally excluded from the board.
 *
 * Accent hexes are drawn from the Fullmind brand palette already used across the
 * views feature (see detail/atoms STAGE_PILL and tokens.md). Funnel hues
 * progress cool→warm; Closed Won is green, Closed Lost is coral.
 */
export interface OppStageColumn {
  /** Stable column id (also the React key and the response column id). */
  id: string;
  /** Header label. */
  label: string;
  /** Exact `opportunities.stage` value this column matches. */
  stage: string;
  /** Accent hex for the header bar + card signal dot. */
  accent: string;
}

export const OPP_STAGE_COLUMNS: readonly OppStageColumn[] = [
  { id: "meeting_booked", label: "Meeting Booked", stage: "0 - Meeting Booked", accent: "#A69DC0" },
  { id: "discovery",      label: "Discovery",      stage: "1 - Discovery",      accent: "#6EA3BE" },
  { id: "presentation",   label: "Presentation",   stage: "2 - Presentation",   accent: "#6E5FA8" },
  { id: "proposal",       label: "Proposal",       stage: "3 - Proposal",       accent: "#E0A93B" },
  { id: "negotiation",    label: "Negotiation",    stage: "4 - Negotiation",    accent: "#D98C4A" },
  { id: "commitment",     label: "Commitment",     stage: "5 - Commitment",     accent: "#C58BB0" },
  { id: "closed_won",     label: "Closed Won",     stage: "Closed Won",         accent: "#69B34A" },
  { id: "closed_lost",    label: "Closed Lost",    stage: "Closed Lost",        accent: "#F37167" },
] as const;

/** The eight matched stage strings — used as the SQL `stage = ANY($)` allowlist. */
export const OPP_KANBAN_STAGES: readonly string[] = OPP_STAGE_COLUMNS.map((c) => c.stage);

/** Look up the column a raw stage string belongs to, or undefined if excluded. */
export function columnForStage(
  stage: string | null | undefined,
): OppStageColumn | undefined {
  if (!stage) return undefined;
  return OPP_STAGE_COLUMNS.find((c) => c.stage === stage);
}
