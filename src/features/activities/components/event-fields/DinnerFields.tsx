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
    <div className="space-y-5">
      {/* Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time
        </label>
        <input
          type="time"
          value={metadata.time || ""}
          onChange={(e) => onMetadataChange({ ...metadata, time: e.target.value || undefined })}
          className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
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

      {/* Invite Link */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Invite Link
        </label>
        <input
          type="url"
          value={metadata.inviteUrl || ""}
          onChange={(e) => onMetadataChange({ ...metadata, inviteUrl: e.target.value || undefined })}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
        />
      </div>

      {/* Google Calendar Link */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google Calendar Link
        </label>
        <input
          type="url"
          value={metadata.googleCalendarUrl || ""}
          onChange={(e) => onMetadataChange({ ...metadata, googleCalendarUrl: e.target.value || undefined })}
          placeholder="https://calendar.google.com/..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
        />
      </div>

      {/* Attendees */}
      <AttendeeSelect selectedUserIds={attendeeUserIds} onChange={onAttendeeChange} />
    </div>
  );
}
