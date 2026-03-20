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
  currentIndex?: number;
  totalCount?: number;
}

export default function PlanDetailModal({
  planId,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
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
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Modal + navigation — matches DistrictExploreModal layout */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          {/* Prev arrow */}
          {onPrev ? (
            <button
              onClick={onPrev}
              className="shrink-0 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-[#D4CFE2]/60 flex items-center justify-center text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
              title="Previous plan (←)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : <div className="w-10 shrink-0" />}

          {/* Center column: back button + modal + counter */}
          <div className="flex flex-col items-start gap-2">
            {/* Back to results */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-xs font-semibold text-[#544A78] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Return to Map
            </button>

            {/* Modal container */}
            <div className="relative bg-white rounded-2xl shadow-xl w-[70vw] max-w-[1076px] h-[70vh] max-h-[745px] flex overflow-hidden">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 z-10 p-2 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

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
                  <PlanDetailSidebar plan={plan} />
                  <PlanDetailTabs plan={plan} onClose={onClose} />
                </div>
              ) : null}
            </div>

            {/* Counter */}
            {currentIndex != null && totalCount != null && totalCount > 0 && (
              <span className="self-center px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-xs font-semibold text-[#544A78]">
                {currentIndex + 1} of {totalCount}
              </span>
            )}
          </div>

          {/* Next arrow */}
          {onNext ? (
            <button
              onClick={onNext}
              className="shrink-0 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-[#D4CFE2]/60 flex items-center justify-center text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
              title="Next plan (→)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : <div className="w-10 shrink-0" />}
        </div>
      </div>
    </>,
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
