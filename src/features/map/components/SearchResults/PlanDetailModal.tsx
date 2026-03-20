"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTerritoryPlan } from "@/lib/api";
import PlanDetailSidebar from "./PlanDetailSidebar";
import PlanDetailTabs from "./PlanDetailTabs";

interface PlanDetailModalProps {
  planId: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function PlanDetailModal({
  planId,
  onClose,
  onPrev,
  onNext,
}: PlanDetailModalProps) {
  const { data: plan, isLoading, error } = useTerritoryPlan(planId);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[92vw] max-w-[1200px] h-[88vh] max-h-[900px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg hover:bg-[#f0edf5] flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="#8A80A8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Prev/Next nav */}
        {onPrev && (
          <button
            onClick={onPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 z-10 w-9 h-9 rounded-full bg-white/90 shadow-lg hover:bg-white flex items-center justify-center transition-all"
            aria-label="Previous plan"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7L9 11" stroke="#544A78" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 z-10 w-9 h-9 rounded-full bg-white/90 shadow-lg hover:bg-white flex items-center justify-center transition-all"
            aria-label="Next plan"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="#544A78" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* Content */}
        {isLoading ? (
          <ModalSkeleton />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-sm font-medium text-[#F37167]">Failed to load plan</p>
              <p className="text-xs text-[#8A80A8] mt-1">{error.message}</p>
            </div>
          </div>
        ) : plan ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Left sidebar */}
            <PlanDetailSidebar plan={plan} />
            {/* Right tabbed content */}
            <PlanDetailTabs plan={plan} onClose={onClose} />
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function ModalSkeleton() {
  return (
    <div className="flex-1 flex">
      {/* Sidebar skeleton */}
      <div className="w-[280px] border-r border-[#E2DEEC] p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-[#f0edf5]" />
          <div className="h-5 bg-[#f0edf5] rounded w-3/4" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 bg-[#f0edf5] rounded-full w-12" />
          <div className="h-5 bg-[#f0edf5] rounded-full w-16" />
        </div>
        <div className="space-y-2 pt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-[#f0edf5] rounded w-full" />
          ))}
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-5 space-y-4 animate-pulse">
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 bg-[#f0edf5] rounded w-20" />
          ))}
        </div>
        <div className="space-y-3 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#f0edf5] rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
