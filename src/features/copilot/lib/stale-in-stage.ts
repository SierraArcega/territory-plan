/** Minimal stage_history entry shape (matches /api/deals/events). */
export interface StageHistoryEntry {
  stage: string;
  changed_at: string;
}

export interface StageOpp {
  stage: string | null;
  stageHistory: StageHistoryEntry[];
  createdAt: string | null;
}

/** Require this many open opps in a stage before we trust its average. */
const MIN_OPPS_PER_STAGE = 3;

function isEntry(v: unknown): v is StageHistoryEntry {
  return (
    !!v && typeof v === "object" &&
    typeof (v as StageHistoryEntry).stage === "string" &&
    typeof (v as StageHistoryEntry).changed_at === "string"
  );
}

/** When the opp entered its current stage: latest stage_history entry for that
 *  stage, else createdAt, else null (excluded). Returns ms time-in-stage. */
function timeInStageMs(opp: StageOpp, now: Date): number | null {
  if (!opp.stage) return null;
  const entries = (opp.stageHistory ?? [])
    .filter(isEntry)
    .filter((h) => h.stage === opp.stage)
    .map((h) => new Date(h.changed_at).getTime())
    .filter((t) => !Number.isNaN(t));
  const enteredAt =
    entries.length > 0 ? Math.max(...entries)
    : opp.createdAt ? new Date(opp.createdAt).getTime()
    : null;
  if (enteredAt == null || Number.isNaN(enteredAt)) return null;
  return now.getTime() - enteredAt;
}

/**
 * Count open opps sitting in their current stage longer than the average
 * time-in-stage for that stage. Stages with < MIN_OPPS_PER_STAGE are skipped.
 */
export function computeStaleInStageCount(opps: StageOpp[], now: Date): number {
  const byStage = new Map<string, number[]>();
  const oppTimes: Array<{ stage: string; t: number }> = [];

  for (const opp of opps) {
    if (!opp.stage) continue;
    const t = timeInStageMs(opp, now);
    if (t == null) continue;
    oppTimes.push({ stage: opp.stage, t });
    byStage.set(opp.stage, [...(byStage.get(opp.stage) ?? []), t]);
  }

  const avgByStage = new Map<string, number>();
  for (const [stage, times] of byStage) {
    if (times.length < MIN_OPPS_PER_STAGE) continue;
    avgByStage.set(stage, times.reduce((a, b) => a + b, 0) / times.length);
  }

  return oppTimes.filter(({ stage, t }) => {
    const avg = avgByStage.get(stage);
    return avg != null && t > avg;
  }).length;
}
