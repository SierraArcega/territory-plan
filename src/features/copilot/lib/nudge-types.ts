export type NudgeKind = "deals_slipping" | "follow_ups_due" | "stale_plans" | "stale_in_stage";
export type NudgeSeverity = "risk" | "opportunity";

/** One proactive "Worth your attention" item shown in the home state. */
export interface CopilotNudge {
  /** Stable per kind (used as React key + click id). */
  id: NudgeKind;
  kind: NudgeKind;
  severity: NudgeSeverity;
  /** Bold line, e.g. "3 deals are slipping". */
  headline: string;
  /** One-line reason, e.g. "Close dates passed". */
  reason: string;
  count: number;
  /** Prompt injected into the composer when the rep taps the nudge. */
  seedPrompt: string;
}
