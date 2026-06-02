"use client";

import { useMemo, useState } from "react";
import { groupOppsByStage, type OppView } from "@/features/home/lib/pipeline";
import { SEGMENT_DEFS, type SegmentKey } from "@/features/home/lib/segments";
import FunnelChart from "./FunnelChart";
import StageDealsModal from "./StageDealsModal";

type SourceFilter = "all" | SegmentKey;
const SOURCES: { key: SourceFilter; label: string; color?: string }[] = [
  { key: "all", label: "All sources" },
  ...SEGMENT_DEFS.map((d) => ({ key: d.key, label: d.label, color: d.color })),
];

// Structural stage funnel for the caller's open book, with a real source filter
// (re-groups the opps client-side) and a click-through stage-deals modal.
export default function FunnelCard({ opps }: { opps: OppView[] }) {
  const [source, setSource] = useState<SourceFilter>("all");
  const [stage, setStage] = useState<number | null>(null);

  const stages = useMemo(() => groupOppsByStage(opps, source), [opps, source]);
  const filteredOpps = useMemo(() => (source === "all" ? opps : opps.filter((o) => o.source === source)), [opps, source]);

  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">Stage funnel</h3>
          <p className="text-xs text-[#8A80A8]">Open deals by stage · max budget (left) · min commit (right). Click a stage to drill in.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCES.map((s) => {
            const active = source === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSource(s.key)}
                className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
                style={active ? { borderColor: s.color ?? "#403770", color: s.color ?? "#403770", background: "#F7F5FA" } : { borderColor: "#D4CFE2", color: "#5C5378" }}
              >
                {s.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <FunnelChart stages={stages} onStageClick={setStage} />
      <StageDealsModal stagePrefix={stage} opps={filteredOpps} onClose={() => setStage(null)} />
    </div>
  );
}
