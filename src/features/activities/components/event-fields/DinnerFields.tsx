"use client";

import type { SocialEventMetadata } from "@/features/activities/types";
import AddressInput from "./AddressInput";
import AttendeeSelect from "./AttendeeSelect";

interface DinnerFieldsProps {
  metadata: SocialEventMetadata;
  onMetadataChange: (metadata: SocialEventMetadata) => void;
  attendeeUserIds: string[];
  onAttendeeChange: (userIds: string[]) => void;
}

export default function DinnerFields({
  metadata,
  onMetadataChange,
  attendeeUserIds,
  onAttendeeChange,
}: DinnerFieldsProps) {
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
            Location / Address
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

      {/* Links side-by-side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Invite Link
          </label>
          <input
            type="url"
            value={metadata.inviteUrl || ""}
            onChange={(e) => onMetadataChange({ ...metadata, inviteUrl: e.target.value || undefined })}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            GCal Link
          </label>
          <input
            type="url"
            value={metadata.googleCalendarUrl || ""}
            onChange={(e) => onMetadataChange({ ...metadata, googleCalendarUrl: e.target.value || undefined })}
            placeholder="https://calendar.google.com/..."
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
      </div>

      {/* Attendees */}
      <AttendeeSelect selectedUserIds={attendeeUserIds} onChange={onAttendeeChange} />
    </div>
  );
}
