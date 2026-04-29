"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import RevenueOverviewTab from "./RevenueOverviewTab";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDetails: () => void;
}

export default function LeaderboardModal({
  isOpen,
  onClose,
  onNavigateToDetails,
}: LeaderboardModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFEDF5]">
          <h2 className="text-lg font-bold text-[#403770]">Leaderboard</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToDetails}
              className="text-xs font-semibold text-[#403770] hover:underline"
            >
              Show me details
            </button>
            <button
              onClick={onClose}
              className="text-[#8A80A8] hover:text-[#403770]"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <RevenueOverviewTab />
        </div>
      </div>
    </div>
  );
}
