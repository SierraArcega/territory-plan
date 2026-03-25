"use client";

import { useState, useEffect } from "react";
import { useShareReportMutation } from "../lib/queries";

interface ShareModalProps {
  reportId: string;
  currentSharedWith: string[];
  onClose: () => void;
}

export default function ShareModal({
  reportId,
  currentSharedWith,
  onClose,
}: ShareModalProps) {
  const [sharedWith, setSharedWith] = useState<string[]>(currentSharedWith);
  const [newUserId, setNewUserId] = useState("");
  const shareMutation = useShareReportMutation();

  // Sync if parent changes
  useEffect(() => {
    setSharedWith(currentSharedWith);
  }, [currentSharedWith]);

  const handleAdd = () => {
    const trimmed = newUserId.trim();
    if (trimmed && !sharedWith.includes(trimmed)) {
      setSharedWith([...sharedWith, trimmed]);
      setNewUserId("");
    }
  };

  const handleRemove = (id: string) => {
    setSharedWith(sharedWith.filter((uid) => uid !== id));
  };

  const handleSave = () => {
    shareMutation.mutate(
      { id: reportId, sharedWith },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#403770]/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-[#403770]">
            Share Report
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#EFEDF5] transition-colors text-[#6E6390]"
          >
            <svg
              className="w-5 h-5"
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
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-sm text-[#6E6390] mb-4">
            Enter user IDs to share this report with. Shared users can view but
            not edit.
          </p>

          {/* Add user input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="Enter user ID..."
              className="flex-1 px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent placeholder:text-[#A69DC0]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!newUserId.trim()}
              className="px-4 py-2 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>

          {/* Shared users list */}
          {sharedWith.length > 0 ? (
            <div className="space-y-2 mb-4">
              {sharedWith.map((uid) => (
                <div
                  key={uid}
                  className="flex items-center justify-between px-3 py-2 bg-[#F7F5FA] rounded-lg"
                >
                  <span className="text-sm text-[#403770] font-medium truncate">
                    {uid}
                  </span>
                  <button
                    onClick={() => handleRemove(uid)}
                    className="text-xs text-[#8A80A8] hover:text-[#F37167] transition-colors font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#A69DC0] italic mb-4">
              Not shared with anyone
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={shareMutation.isPending}
              className="px-4 py-2 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {shareMutation.isPending ? "Saving..." : "Save Sharing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
