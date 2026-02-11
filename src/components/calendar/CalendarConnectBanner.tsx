// CalendarConnectBanner — Shown when the rep hasn't connected their Google Calendar
// Warm gradient card with Google Calendar icon and "Connect" CTA
// Dismissable via localStorage so it doesn't nag on every visit

"use client";

import { useState, useEffect } from "react";

const DISMISS_KEY = "calendar-connect-banner-dismissed";

export default function CalendarConnectBanner() {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to avoid flash

  // Check localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setIsDismissed(true);
  };

  const handleConnect = () => {
    // Navigate to the calendar connect endpoint — this redirects to Google OAuth
    window.location.href = "/api/calendar/connect";
  };

  if (isDismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#403770]/20 mb-4"
      style={{
        background: "linear-gradient(135deg, #403770 0%, #4e3d7a 40%, #5c4785 70%, #6b5a90 100%)",
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-white/50 hover:text-white/80 transition-colors"
        title="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center gap-4 px-5 py-4">
        {/* Google Calendar icon */}
        <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
            <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="2" fill="currentColor" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">
            Sync your Google Calendar
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            Automatically pull meetings with external contacts into your activity tracker.
            The app will suggest which district and plan each meeting belongs to.
          </p>
        </div>

        <button
          onClick={handleConnect}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#403770] bg-white rounded-lg hover:bg-white/90 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Connect
        </button>
      </div>
    </div>
  );
}
