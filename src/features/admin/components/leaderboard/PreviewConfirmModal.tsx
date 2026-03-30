"use client";

import type { PreviewResult } from "@/features/admin/lib/leaderboard-types";
import { X } from "lucide-react";

interface PreviewConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: PreviewResult | null;
  isLoading: boolean;
  isSaving: boolean;
}

export default function PreviewConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  preview,
  isLoading,
  isSaving,
}: PreviewConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
          <h2 className="text-lg font-semibold text-[#403770]">Confirm Changes</h2>
          <button onClick={onClose} className="text-[#8A80A8] hover:text-[#403770]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-[#E2DEEC]/40 rounded animate-pulse" />
              ))}
            </div>
          ) : preview ? (
            <>
              {preview.changes.length > 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-[#6E6390] mb-2">What&apos;s Changing</h3>
                  <div className="space-y-2">
                    {preview.changes.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-[#8A80A8]">{c.field}:</span>
                        <span className="line-through text-[#A69DC0]">{c.before}</span>
                        <span className="text-[#403770]">&rarr;</span>
                        <span className="font-medium text-[#403770]">{c.after}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#8A80A8]">No changes detected.</p>
              )}

              {preview.repImpact && (
                <div className="bg-[#fffaf1] border border-[#ffd98d] rounded-lg p-4">
                  <p className="text-sm font-medium text-[#403770]">
                    {preview.repImpact.count} rep
                    {preview.repImpact.count !== 1 ? "s" : ""} will change tiers
                  </p>
                  <ul className="mt-2 space-y-1">
                    {preview.repImpact.reps.map((r) => (
                      <li key={r.userId} className="text-sm text-[#6E6390]">
                        {r.fullName}: {r.beforeTier} &rarr; {r.afterTier}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2DEEC]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770] rounded-lg hover:bg-[#F7F5FA] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving || isLoading || preview?.changes.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#e0635a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Applying..." : "Apply Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
