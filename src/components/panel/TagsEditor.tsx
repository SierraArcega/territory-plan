"use client";

import { useState } from "react";
import {
  useTags,
  useCreateTag,
  useAddDistrictTag,
  useRemoveDistrictTag,
  type Tag,
} from "@/lib/api";

interface TagsEditorProps {
  leaid: string;
  tags: Tag[];
}

// Predefined tag colors (Fullmind brand compatible)
const TAG_COLORS = [
  "#F37167", // Coral
  "#403770", // Plum
  "#6EA3BE", // Steel Blue
  "#48bb78", // Green
  "#ed8936", // Orange
  "#9f7aea", // Purple
  "#38b2ac", // Teal
  "#e53e3e", // Red
];

export default function TagsEditor({ leaid, tags }: TagsEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const { data: allTags } = useTags();
  const createTagMutation = useCreateTag();
  const addTagMutation = useAddDistrictTag();
  const removeTagMutation = useRemoveDistrictTag();

  // Tags not yet assigned to this district
  const availableTags = allTags?.filter(
    (t) => !tags.some((dt) => dt.id === t.id)
  );

  const handleAddExistingTag = async (tagId: number) => {
    try {
      await addTagMutation.mutateAsync({ leaid, tagId });
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      await removeTagMutation.mutateAsync({ leaid, tagId });
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const tag = await createTagMutation.mutateAsync({
        name: newTagName.trim(),
        color: newTagColor,
      });
      // Also add to this district
      await addTagMutation.mutateAsync({ leaid, tagId: tag.id });
      setNewTagName("");
      setIsAdding(false);
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[#403770]">Tags</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs text-[#F37167] hover:text-[#403770] font-medium"
        >
          {isAdding ? "Cancel" : "+ Add Tag"}
        </button>
      </div>

      {/* Current Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="hover:bg-white/20 rounded-full p-0.5"
                aria-label={`Remove ${tag.name} tag`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-400 italic">No tags</span>
        )}
      </div>

      {/* Add Tag UI */}
      {isAdding && (
        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          {/* Existing Tags */}
          {availableTags && availableTags.length > 0 && (
            <div>
              <span className="text-xs text-gray-500">Add existing tag:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddExistingTag(tag.id)}
                    className="px-2 py-1 text-xs rounded-full text-white hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: tag.color }}
                  >
                    + {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create New Tag */}
          <div>
            <span className="text-xs text-gray-500">Or create new tag:</span>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                maxLength={50}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
              />
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createTagMutation.isPending}
                className="px-3 py-1.5 text-sm bg-[#F37167] text-white rounded-md hover:bg-[#e05f55] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>

            {/* Color Picker */}
            <div className="flex gap-1 mt-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-6 h-6 rounded-full border-2 ${
                    newTagColor === color
                      ? "border-[#403770]"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select ${color} color`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
