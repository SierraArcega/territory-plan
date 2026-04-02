"use client";

import type { SponsorshipMetadata } from "@/features/activities/types";
import AddressInput from "./AddressInput";

interface SponsorshipFieldsProps {
  metadata: SponsorshipMetadata;
  onMetadataChange: (metadata: SponsorshipMetadata) => void;
}

export default function SponsorshipFields({
  metadata,
  onMetadataChange,
}: SponsorshipFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Event Name */}
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Event Name
        </label>
        <input
          type="text"
          value={metadata.eventName || ""}
          onChange={(e) => onMetadataChange({ ...metadata, eventName: e.target.value || undefined })}
          placeholder="e.g. ISTE 2026"
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>

      {/* Cost */}
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Cost
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A80A8]">$</span>
          <input
            type="number"
            min={0}
            value={metadata.cost ?? ""}
            onChange={(e) => onMetadataChange({ ...metadata, cost: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="0.00"
            className="w-full pl-7 pr-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
      </div>

      {/* Location */}
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
  );
}
