"use client";

import type { EmailMetadata } from "@/features/activities/types";

interface EmailFieldsProps {
  metadata: EmailMetadata;
  onMetadataChange: (metadata: EmailMetadata) => void;
}

export default function EmailFields({
  metadata,
  onMetadataChange,
}: EmailFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Subject & Direction */}
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Subject
          </label>
          <input
            type="text"
            value={metadata.subject || ""}
            onChange={(e) => onMetadataChange({ ...metadata, subject: e.target.value || undefined })}
            placeholder="Email subject line"
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Direction
          </label>
          <select
            value={metadata.direction || "outbound"}
            onChange={(e) =>
              onMetadataChange({ ...metadata, direction: e.target.value as EmailMetadata["direction"] })
            }
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white"
          >
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </div>
      </div>

      {/* Thread link */}
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Thread link
        </label>
        <input
          type="url"
          value={metadata.threadLink || ""}
          onChange={(e) => onMetadataChange({ ...metadata, threadLink: e.target.value || undefined })}
          placeholder="https://mail.google.com/..."
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>
    </div>
  );
}
