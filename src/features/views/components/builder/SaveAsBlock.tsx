"use client";

/**
 * SaveAsBlock — list-name text input + share-with-team checkbox. The trailing
 * label uses the Lucide Users icon for visual continuity with the GroupHeader
 * "Shared" pill.
 */
import { Users } from "lucide-react";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import { NAME_PLACEHOLDER } from "./builder-utils";

interface SaveAsBlockProps {
  source: SavedListSource;
  name: string;
  shared: boolean;
  onNameChange: (next: string) => void;
  onSharedChange: (next: boolean) => void;
}

export default function SaveAsBlock({
  source,
  name,
  shared,
  onNameChange,
  onSharedChange,
}: SaveAsBlockProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <input
        type="text"
        aria-label="List name"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={NAME_PLACEHOLDER[source]}
        className="w-full px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg outline-none focus:border-[#403770] placeholder:text-[#A69DC0]"
      />
      <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-[#544A78]">
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => onSharedChange(e.target.checked)}
          className="accent-[#F37167]"
          aria-label="Share with my team"
        />
        <Users className="w-3.5 h-3.5 text-[#8A80A8]" aria-hidden />
        <span className="whitespace-nowrap">Share with my team</span>
      </label>
    </div>
  );
}
