"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUpdateDistrictEdits, useUsers, type DistrictEdits } from "@/lib/api";

interface NotesEditorProps {
  leaid: string;
  edits: DistrictEdits | null;
}

export default function NotesEditor({ leaid, edits }: NotesEditorProps) {
  const [notes, setNotes] = useState(edits?.notes || "");
  const [ownerId, setOwnerId] = useState(edits?.owner?.id || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updateMutation = useUpdateDistrictEdits();
  const { data: users } = useUsers();

  // Reset when edits change
  useEffect(() => {
    setNotes(edits?.notes || "");
    setOwnerId(edits?.owner?.id || "");
    setIsDirty(false);
  }, [edits]);

  // Close dropdown on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setOwnerDropdownOpen(false);
    }
  }, []);

  useEffect(() => {
    if (ownerDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [ownerDropdownOpen, handleOutsideClick]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ leaid, notes, ownerId: ownerId || undefined });
      setIsEditing(false);
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const handleCancel = () => {
    setNotes(edits?.notes || "");
    setOwnerId(edits?.owner?.id || "");
    setIsEditing(false);
    setIsDirty(false);
    setOwnerDropdownOpen(false);
  };

  // Resolve display name from ownerId
  const ownerDisplayName = (() => {
    if (!ownerId) return null;
    // First check if edits.owner matches
    if (edits?.owner?.id === ownerId && edits?.owner?.fullName) {
      return edits.owner.fullName;
    }
    // Otherwise look up from users list
    const user = users?.find((u) => u.id === ownerId);
    return user?.fullName || user?.email || null;
  })();

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
          {/* Owner Dropdown */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-xs text-[#8A80A8] mb-1">Owner</label>
            <button
              type="button"
              onClick={() => setOwnerDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-left"
            >
              <span className={ownerId ? "text-[#403770]" : "text-[#A69DC0]"}>
                {ownerDisplayName || "Select an owner..."}
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[#A69DC0]">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {ownerDropdownOpen && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <div className="max-h-48 overflow-y-auto py-1">
                  <button
                    onClick={() => { setOwnerId(""); setOwnerDropdownOpen(false); setIsDirty(true); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      !ownerId ? "bg-[#403770]/5 text-[#403770] font-medium" : "text-[#A69DC0] italic hover:bg-[#F7F5FA]"
                    }`}
                  >
                    &mdash; Unassigned &mdash;
                  </button>
                  {(users || []).map((u) => {
                    const display = u.fullName || u.email;
                    const selected = ownerId === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => { setOwnerId(u.id); setOwnerDropdownOpen(false); setIsDirty(true); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          selected ? "bg-[#403770]/5 text-[#403770] font-medium" : "text-gray-700 hover:bg-[#F7F5FA]"
                        }`}
                      >
                        {display}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-[#8A80A8] mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Add notes about this district..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
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
          {/* Owner Display */}
          <div>
            <span className="text-xs text-[#8A80A8]">Owner</span>
            <p className="text-sm text-[#403770]">
              {edits?.owner?.fullName || (
                <span className="text-[#A69DC0] italic">No owner assigned</span>
              )}
            </p>
          </div>

          {/* Notes Display */}
          <div>
            <span className="text-xs text-[#8A80A8]">Notes</span>
            {notes ? (
              <p className="text-sm text-[#403770] whitespace-pre-wrap">
                {notes}
              </p>
            ) : (
              <p className="text-sm text-[#A69DC0] italic">No notes</p>
            )}
          </div>

          {/* Last updated */}
          {edits?.updatedAt && (
            <p className="text-xs text-[#A69DC0] mt-2" suppressHydrationWarning>
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
