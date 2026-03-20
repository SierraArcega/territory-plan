"use client";

import type { ProfessionalDevelopmentMetadata } from "@/features/activities/types";
import AddressInput from "./AddressInput";

interface ProfessionalDevelopmentFieldsProps {
  metadata: ProfessionalDevelopmentMetadata;
  onMetadataChange: (metadata: ProfessionalDevelopmentMetadata) => void;
}

export default function ProfessionalDevelopmentFields({
  metadata,
  onMetadataChange,
}: ProfessionalDevelopmentFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Time & Address */}
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Time
          </label>
          <input
            type="time"
            value={metadata.time || ""}
            onChange={(e) => onMetadataChange({ ...metadata, time: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Location
          </label>
          <AddressInput
            value={metadata.address || ""}
            onChange={(address, lat, lng) =>
              onMetadataChange({
                ...metadata,
                address: address || undefined,
                addressLat: lat,
                addressLng: lng,
              })
            }
          />
        </div>
      </div>

      {/* Topic */}
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Topic
        </label>
        <input
          type="text"
          value={metadata.topic || ""}
          onChange={(e) => onMetadataChange({ ...metadata, topic: e.target.value || undefined })}
          placeholder="What is the session about?"
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>
    </div>
  );
}
