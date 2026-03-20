"use client";

import type { WebinarMetadata } from "@/features/activities/types";

interface WebinarFieldsProps {
  metadata: WebinarMetadata;
  onMetadataChange: (metadata: WebinarMetadata) => void;
}

export default function WebinarFields({
  metadata,
  onMetadataChange,
}: WebinarFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Time & Platform URL */}
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
            Platform URL
          </label>
          <input
            type="url"
            value={metadata.platformUrl || ""}
            onChange={(e) => onMetadataChange({ ...metadata, platformUrl: e.target.value || undefined })}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
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
          placeholder="What is the webinar about?"
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>
    </div>
  );
}
