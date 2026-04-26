"use client";

import type { QueryParams } from "../../lib/types";
import SourceChip from "./SourceChip";
import IncludingChips from "./IncludingChips";
import FilterChips from "./FilterChips";
import ColumnsChip from "./ColumnsChip";
import SortChip from "./SortChip";
import StatusChip from "./StatusChip";

interface Props {
  params: QueryParams;
  onChange: (params: QueryParams) => void;
  dirty: boolean;
  running: boolean;
  hasSnapshot: boolean;
  onRun: () => void;
}

const DIVIDER = <div className="h-11 w-px bg-[#D4CFE2]" aria-hidden />;

export default function BuilderStrip(props: Props) {
  return (
    <div className="flex items-start gap-5 border-b border-[#E2DEEC] bg-[#F7F5FA] px-8 py-5 flex-wrap">
      <SourceChip params={props.params} onChange={props.onChange} />
      {DIVIDER}
      <IncludingChips params={props.params} onChange={props.onChange} />
      {DIVIDER}
      <FilterChips params={props.params} onChange={props.onChange} />
      {DIVIDER}
      <ColumnsChip params={props.params} onChange={props.onChange} />
      {DIVIDER}
      <SortChip params={props.params} onChange={props.onChange} />
      <div className="flex-1 min-w-px" aria-hidden />
      <StatusChip
        params={props.params}
        dirty={props.dirty}
        running={props.running}
        hasSnapshot={props.hasSnapshot}
        onRun={props.onRun}
      />
    </div>
  );
}
