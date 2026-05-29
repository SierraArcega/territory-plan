// Targets card rollups. "Districts being worked" = ALL plan-districts the rep
// owns (membership), counted whether or not a target $ is set (revised 2026-05-29,
// supersedes the earlier renewal-only exclusion). Districts WITH a
// new/winback/expansion target are bucketed into the segment with their largest
// such target (ties: new > winback > expansion); districts with none are tracked
// as `untargetedCount` (surfaced as its own sub-row, not guessed into a segment).
// Rank-vs-team is by total target $ committed (sum of new+winback+expansion); the
// card headline is the total worked-district count.

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
  untargetedCount: number;
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
    let rollup = rollups.get(d.repId);
    if (!rollup) {
      rollup = { workedCount: 0, untargetedCount: 0, targetDollars: 0, segments: { new: 0, winback: 0, expansion: 0 } };
      rollups.set(d.repId, rollup);
    }
    rollup.workedCount += 1;
    const seg = districtSegment(d);
    if (seg) rollup.segments[seg] += 1;
    else rollup.untargetedCount += 1;
    rollup.targetDollars += d.newBusinessTarget + d.winbackTarget + d.expansionTarget;
  }
  return rollups;
}

// All of a rep's deduped worked-district leaids (every plan district, targeted or
// not) — the set the "converted to pipeline" and "active · 90d" sub-counts run over.
export function workedLeaidsForRep(rows: PlanDistrictTargets[], repId: string): string[] {
  const leaids: string[] = [];
  for (const d of dedupeByRepDistrict(rows).values()) {
    if (d.repId === repId) leaids.push(d.leaid);
  }
  return leaids;
}
