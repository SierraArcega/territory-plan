"use client";

import type { CourseMetadata } from "@/features/activities/types";

interface CourseFieldsProps {
  metadata: CourseMetadata;
  onMetadataChange: (metadata: CourseMetadata) => void;
}

export default function CourseFields({
  metadata,
  onMetadataChange,
}: CourseFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Platform URL & Provider */}
      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Provider
          </label>
          <input
            type="text"
            value={metadata.provider || ""}
            onChange={(e) => onMetadataChange({ ...metadata, provider: e.target.value || undefined })}
            placeholder="e.g. Coursera, Udemy"
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
          placeholder="What is the course about?"
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>
    </div>
  );
}
