"use client";

import type { ConferenceMetadata } from "@/features/activities/types";
import AddressInput from "./AddressInput";
import CustomSelect from "./CustomSelect";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Los_Angeles": "Pacific",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

interface ConferenceFieldsProps {
  metadata: ConferenceMetadata;
  onMetadataChange: (metadata: ConferenceMetadata) => void;
}

export default function ConferenceFields({
  metadata,
  onMetadataChange,
}: ConferenceFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Website & Timezone side-by-side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Website
          </label>
          <input
            type="url"
            value={metadata.websiteUrl || ""}
            onChange={(e) => onMetadataChange({ ...metadata, websiteUrl: e.target.value || undefined })}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
        <CustomSelect
          label="Timezone"
          value={metadata.timezone || ""}
          onChange={(val) => onMetadataChange({ ...metadata, timezone: val || undefined })}
          placeholder="Select..."
          options={TIMEZONES.map((tz) => ({ value: tz, label: TIMEZONE_LABELS[tz] || tz }))}
        />
      </div>

      {/* Address */}
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
