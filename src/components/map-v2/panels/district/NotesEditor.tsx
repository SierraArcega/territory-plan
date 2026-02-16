"use client";

import { useState, useEffect } from "react";
import { useUpdateDistrictEdits, type DistrictEdits } from "@/lib/api";

interface NotesEditorProps {
  leaid: string;
  edits: DistrictEdits | null;
}

export default function NotesEditor({ leaid, edits }: NotesEditorProps) {
  const [notes, setNotes] = useState(edits?.notes || "");
  const [owner, setOwner] = useState(edits?.owner || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const updateMutation = useUpdateDistrictEdits();

  useEffect(() => {
    setNotes(edits?.notes || "");
    setOwner(edits?.owner || "");
    setIsDirty(false);
  }, [edits]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ leaid, notes, owner });
      setIsEditing(false);
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const handleCancel = () => {
    setNotes(edits?.notes || "");
    setOwner(edits?.owner || "");
    setIsEditing(false);
    setIsDirty(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[#403770]">Notes & Owner</h3>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-[#F37167] hover:text-[#403770] font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Owner</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => { setOwner(e.target.value); setIsDirty(true); }}
              placeholder="Assign an owner..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
              placeholder="Add notes about this district..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-[#403770]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
              className="px-3 py-1.5 text-sm bg-[#F37167] text-white rounded-md hover:bg-[#e05f55] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <span className="text-xs text-gray-500">Owner</span>
            <p className="text-sm text-[#403770]">
              {owner || <span className="text-gray-400 italic">No owner assigned</span>}
            </p>
          </div>

          <div>
            <span className="text-xs text-gray-500">Notes</span>
            {notes ? (
              <p className="text-sm text-[#403770] whitespace-pre-wrap">{notes}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No notes</p>
            )}
          </div>

          {edits?.updatedAt && (
            <p className="text-xs text-gray-400 mt-2" suppressHydrationWarning>
              Last updated:{" "}
              {new Date(edits.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
