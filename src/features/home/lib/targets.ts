// Targets card rollups. "Districts being worked" = plan-districts the rep owns
// with a non-zero new/winback/expansion target; renewal-only districts are
// EXCLUDED (locked 2026-05-29). Each district is bucketed into the segment with
// its largest such target (ties: new > winback > expansion). Rank-vs-team is by
// total target $ committed (sum of new+winback+expansion over worked districts);
// the card headline is the worked-district count.

export type TargetSegment = "new" | "winback" | "expansion";

interface SegmentTargets {
  newBusinessTarget: number;
  winbackTarget: number;
  expansionTarget: number;
}

export interface PlanDistrictTargets extends SegmentTargets {
  repId: string;
  leaid: string;
  renewalTarget: number;
}

export interface TargetsRollup {
  workedCount: number;
  targetDollars: number;
  segments: Record<TargetSegment, number>;
}

export function districtSegment(t: SegmentTargets): TargetSegment | null {
  const ordered: [TargetSegment, number][] = [
    ["new", t.newBusinessTarget ?? 0],
    ["winback", t.winbackTarget ?? 0],
    ["expansion", t.expansionTarget ?? 0],
  ];
  let best: TargetSegment | null = null;
  let bestValue = 0;
  for (const [seg, value] of ordered) {
    if (value > 0 && value > bestValue) {
      best = seg;
      bestValue = value;
    }
  }
  return best;
}

// Dedupe a district that appears in multiple of a rep's plans: sum its target
// columns so it's counted once with combined targets.
function dedupeByRepDistrict(rows: PlanDistrictTargets[]): Map<string, PlanDistrictTargets> {
  const byRepDistrict = new Map<string, PlanDistrictTargets>();
  for (const r of rows) {
    const key = `${r.repId}::${r.leaid}`;
    const existing = byRepDistrict.get(key);
    if (existing) {
      existing.newBusinessTarget += r.newBusinessTarget ?? 0;
      existing.winbackTarget += r.winbackTarget ?? 0;
      existing.expansionTarget += r.expansionTarget ?? 0;
      existing.renewalTarget += r.renewalTarget ?? 0;
    } else {
      byRepDistrict.set(key, {
        repId: r.repId,
        leaid: r.leaid,
        newBusinessTarget: r.newBusinessTarget ?? 0,
        winbackTarget: r.winbackTarget ?? 0,
        expansionTarget: r.expansionTarget ?? 0,
        renewalTarget: r.renewalTarget ?? 0,
      });
    }
  }
  return byRepDistrict;
}

export function buildTargetsRollups(rows: PlanDistrictTargets[]): Map<string, TargetsRollup> {
  const rollups = new Map<string, TargetsRollup>();
  for (const d of dedupeByRepDistrict(rows).values()) {
    const seg = districtSegment(d);
    if (!seg) continue;
    let rollup = rollups.get(d.repId);
    if (!rollup) {
      rollup = { workedCount: 0, targetDollars: 0, segments: { new: 0, winback: 0, expansion: 0 } };
      rollups.set(d.repId, rollup);
    }
    rollup.workedCount += 1;
    rollup.segments[seg] += 1;
    rollup.targetDollars += d.newBusinessTarget + d.winbackTarget + d.expansionTarget;
  }
  return rollups;
}

// The deduped worked-district leaids for one rep — the set the "converted to
// pipeline" and "active · 90d" sub-counts are computed against.
export function workedLeaidsForRep(rows: PlanDistrictTargets[], repId: string): string[] {
  const leaids: string[] = [];
  for (const d of dedupeByRepDistrict(rows).values()) {
    if (d.repId === repId && districtSegment(d)) leaids.push(d.leaid);
  }
  return leaids;
}
