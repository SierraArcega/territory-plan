"use client";

import { Loader2 } from "lucide-react";
import { friendlyProgressLabel } from "../lib/progress-labels";
import type { TurnEvent } from "../lib/types";

export function CopilotProgress({ events }: { events: TurnEvent[] | undefined }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#6E6390]">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="whitespace-nowrap">{friendlyProgressLabel(events)}</span>
    </div>
  );
}
