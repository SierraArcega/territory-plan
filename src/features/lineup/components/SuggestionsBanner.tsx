"use client";

import { useState } from "react";
import { useLineupSuggestions, useSuggestionFeedback } from "@/features/lineup/lib/queries";
import SuggestionCard from "./SuggestionCard";

interface SuggestionsBannerProps {
  date: string;
  activityCount: number; // current user's own activity count today (for busy-day detection)
}

export default function SuggestionsBanner({ date, activityCount }: SuggestionsBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const { suggestions, isLoading, error, refetch } = useLineupSuggestions(date);
  const feedback = useSuggestionFeedback();

  // Only show when viewing today (hook returns null suggestions + isLoading:false when date ≠ today)
  if (!isLoading && suggestions === null && !error) return null;

  const isBusy = activityCount >= 4;
  const count = suggestions?.length ?? 0;

  // When in error state, render a div row instead of a button to avoid nesting buttons
  const bannerInner = (
    <>
      <div className="flex items-center gap-2.5">
        <span className="text-[#F37167] text-base leading-none">✦</span>
        <div>
          {isLoading ? (
            <div data-testid="suggestions-banner-loading" className="flex flex-col gap-1">
              <div className="h-2.5 w-32 bg-white/20 rounded animate-pulse" />
              <div className="h-2 w-24 bg-white/10 rounded animate-pulse" />
            </div>
          ) : error ? (
            <div className="text-white text-xs font-semibold">
              Couldn&apos;t load recommendations — try again later
            </div>
          ) : (
            <div>
              <div className="text-white text-xs font-semibold">
                {isBusy
                  ? "Looks like your day is pretty booked — click here if you need more ideas."
                  : `${count} Recommended ${count === 1 ? "Action" : "Actions"}`}
              </div>
              <div className="text-[#A69DC0] text-[10px] mt-0.5">
                Based on your FY{new Date().getFullYear()} goals
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {error && (
          <button
            onClick={() => refetch()}
            className="text-[#A69DC0] text-[10px] font-medium hover:text-white transition-colors"
            aria-label="Try again"
          >
            Try again
          </button>
        )}
        {!isLoading && !error && (
          <span className="text-[#A69DC0] text-[10px] font-medium">
            {isOpen ? "Hide ▲" : "Show ▼"}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className="mb-3">
      {/* Collapsed banner — use div when in error state to avoid nesting buttons */}
      {error ? (
        <div className="w-full bg-[#403770] rounded-lg px-4 py-2.5 flex items-center justify-between text-left">
          {bannerInner}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-full bg-[#403770] rounded-lg px-4 py-2.5 flex items-center justify-between text-left"
          aria-label={
            isLoading
              ? "Loading recommendations..."
              : isBusy
              ? "Looks like your day is pretty booked — click here if you need more ideas."
              : `${count} Recommended ${count === 1 ? "Action" : "Actions"}`
          }
        >
          {bannerInner}
        </button>
      )}

      {/* Floating overlay */}
      {isOpen && suggestions !== null && (
        <div className="mt-2 bg-white border border-[#D4CFE2] rounded-2xl shadow-xl overflow-hidden">
          <div className="p-3 flex flex-col gap-2">
            {suggestions.length === 0 ? (
              <p className="text-[#8A80A8] text-sm text-center py-4">
                Nothing urgent right now — check back tomorrow.
              </p>
            ) : (
              suggestions.map((s, i) => <SuggestionCard key={i} suggestion={s} />)
            )}

            {/* Feedback button — demand signal for AI-powered recommendations */}
            <div className="pt-2 border-t border-[#E2DEEC] mt-1 text-center">
              {feedbackSent ? (
                <span className="text-[#8A80A8] text-[10px]">
                  Thanks! We&apos;re tracking interest.
                </span>
              ) : (
                <button
                  onClick={() => {
                    feedback.mutate(undefined, {
                      onSuccess: () => setFeedbackSent(true),
                    });
                  }}
                  disabled={feedback.isPending}
                  className="text-[#A69DC0] text-[10px] hover:text-[#403770] transition-colors disabled:opacity-50"
                  aria-label="Want AI-powered recommendations?"
                >
                  Want AI-powered recommendations? Let us know →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
