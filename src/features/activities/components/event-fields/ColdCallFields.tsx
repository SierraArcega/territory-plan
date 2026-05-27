"use client";

import type { ColdCallMetadata } from "@/features/activities/types";

interface ColdCallFieldsProps {
  metadata: ColdCallMetadata;
  onMetadataChange: (metadata: ColdCallMetadata) => void;
}

export default function ColdCallFields({
  metadata,
  onMetadataChange,
}: ColdCallFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Call result
        </label>
        <select
          value={metadata.callResult || ""}
          onChange={(e) =>
            onMetadataChange({
              ...metadata,
              callResult: (e.target.value || undefined) as ColdCallMetadata["callResult"],
            })
          }
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white"
        >
          <option value="">Select result…</option>
          <option value="connected">Connected</option>
          <option value="voicemail">Voicemail</option>
          <option value="no_answer">No answer</option>
          <option value="gatekeeper">Gatekeeper</option>
        </select>
      </div>
    </div>
  );
}
