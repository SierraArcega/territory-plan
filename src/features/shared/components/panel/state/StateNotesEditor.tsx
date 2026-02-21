"use client";

import { useState, useCallback, useEffect } from "react";
import { useUpdateState } from "@/lib/api";

interface StateNotesEditorProps {
  stateCode: string;
  notes: string | null;
}

export default function StateNotesEditor({
  stateCode,
  notes,
}: StateNotesEditorProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(notes || "");

  const updateState = useUpdateState();

  // Sync with props when they change
  useEffect(() => {
    setNotesValue(notes || "");
  }, [notes]);

  const handleSaveNotes = useCallback(() => {
    updateState.mutate(
      { stateCode, notes: notesValue },
      {
        onSuccess: () => setIsEditingNotes(false),
      }
    );
  }, [updateState, stateCode, notesValue]);

  const handleCancelNotes = useCallback(() => {
    setNotesValue(notes || "");
    setIsEditingNotes(false);
  }, [notes]);

  return (
    <div className="px-6 py-4 border-t border-gray-100">
      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Notes</label>
          {!isEditingNotes && (
            <button
              onClick={() => setIsEditingNotes(true)}
              className="text-xs text-[#403770] hover:text-[#F37167]"
            >
              {notes ? "Edit" : "Add"}
            </button>
          )}
        </div>
        {isEditingNotes ? (
          <div>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="Add notes about this state..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSaveNotes}
                disabled={updateState.isPending}
                className="px-3 py-1 text-xs font-medium text-white bg-[#403770] rounded hover:bg-[#403770]/90 disabled:opacity-50"
              >
                {updateState.isPending ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancelNotes}
                className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600 whitespace-pre-wrap">
            {notes || <span className="text-gray-400 italic">No notes</span>}
          </div>
        )}
      </div>
    </div>
  );
}
