"use client";

import type { ConferenceMetadata } from "@/features/activities/types";
import AddressInput from "./AddressInput";
import AttendeeSelect from "./AttendeeSelect";
import ExpenseLineItems from "./ExpenseLineItems";

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
  attendeeUserIds: string[];
  onAttendeeChange: (userIds: string[]) => void;
  expenses: { description: string; amount: number }[];
  onExpensesChange: (expenses: { description: string; amount: number }[]) => void;
}

export default function ConferenceFields({
  metadata,
  onMetadataChange,
  attendeeUserIds,
  onAttendeeChange,
  expenses,
  onExpensesChange,
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
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Timezone
          </label>
          <select
            value={metadata.timezone || ""}
            onChange={(e) => onMetadataChange({ ...metadata, timezone: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white"
          >
            <option value="">Select...</option>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {TIMEZONE_LABELS[tz] || tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Venue / Address
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

      {/* Attendees & Expenses */}
      <AttendeeSelect selectedUserIds={attendeeUserIds} onChange={onAttendeeChange} />
      <ExpenseLineItems expenses={expenses} onChange={onExpensesChange} />
    </div>
  );
}
