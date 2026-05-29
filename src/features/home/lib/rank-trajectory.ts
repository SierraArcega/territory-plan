// Pure assembler for the rank-trajectory payload: turns fetched source rows (one
// dated-value list per metric) into the chart/modal-ready shape. Kept DB-free so
// it's unit-testable (mirrors topline.ts); the route does the fetching.

import { schoolYearForFY } from "@/lib/fiscal-year";
import {
  buildSegmentedTrajectory,
  FY_COLUMN_LABELS,
  type DatedValueRow,
  type MetricTrajectory,
} from "./monthly";

export type TrajectoryMetricKey = "targets" | "openPipeline" | "bookings" | "revenue" | "take";

// The five trajectory lines, in prototype order with locked token colors.
export const TRAJECTORY_METRICS: { metricKey: TrajectoryMetricKey; name: string; color: string }[] = [
  { metricKey: "targets", name: "Targets", color: "#8AA891" },
  { metricKey: "openPipeline", name: "Open pipeline", color: "#403770" },
  { metricKey: "bookings", name: "Bookings", color: "#F37167" },
  { metricKey: "revenue", name: "Sched + del rev", color: "#6EA3BE" },
  { metricKey: "take", name: "Take", color: "#FFCF70" },
];

// DOA category → the design's segment key.
const CATEGORY_TO_SEGMENT: Record<string, "return" | "new" | "winback" | "expansion"> = {
  renewal: "return",
  new_business: "new",
  winback: "winback",
  expansion: "expansion",
};

interface RepLine {
  name: string;
  isCaller: boolean;
  ranks: number[];
  values: number[];
}

interface SegmentLine {
  caller: { ranks: number[]; values: number[]; inRoster: boolean };
  reps: RepLine[];
}

export interface MetricSeries {
  metricKey: TrajectoryMetricKey;
  name: string;
  color: string;
  caller: { ranks: number[]; values: number[]; inRoster: boolean };
  reps: RepLine[];
  segments: Partial<Record<"return" | "new" | "winback" | "expansion", SegmentLine>>;
}

export interface RankTrajectoryPayload {
  fy: number;
  schoolYr: string;
  columns: readonly string[];
  todayIndex: number;
  metrics: MetricSeries[];
}

type Roster = { id: string; email: string; fullName: string | null }[];

function repLines(traj: MetricTrajectory, reps: Roster, callerId: string): RepLine[] {
  const nameByEmail = new Map(reps.map((r) => [r.email, r.fullName ?? r.email]));
  const callerEmail = reps.find((r) => r.id === callerId)?.email ?? null;
  return traj.reps.map((r) => ({
    name: nameByEmail.get(r.email) ?? r.email,
    isCaller: r.email === callerEmail,
    ranks: r.ranks,
    values: r.values,
  }));
}

export function buildRankTrajectoryPayload(params: {
  rowsByMetric: Record<string, DatedValueRow[]>;
  fy: number;
  reps: Roster;
  callerId: string;
  now?: Date;
}): RankTrajectoryPayload {
  const { rowsByMetric, fy, reps, callerId, now } = params;

  // todayIndex is FY-relative (identical across metrics); captured from each build.
  let todayIndex = 0;

  const metrics: MetricSeries[] = TRAJECTORY_METRICS.map(({ metricKey, name, color }) => {
    const rows = rowsByMetric[metricKey] ?? [];
    const seg = buildSegmentedTrajectory({ rows, fy, reps, callerId, now });
    todayIndex = seg.all.todayIndex;

    const segments: MetricSeries["segments"] = {};
    for (const [category, traj] of seg.byCategory) {
      const key = CATEGORY_TO_SEGMENT[category];
      if (key) segments[key] = { caller: traj.caller, reps: repLines(traj, reps, callerId) };
    }

    return {
      metricKey,
      name,
      color,
      caller: seg.all.caller,
      reps: repLines(seg.all, reps, callerId),
      segments,
    };
  });

  return { fy, schoolYr: schoolYearForFY(fy), columns: FY_COLUMN_LABELS, todayIndex, metrics };
}
