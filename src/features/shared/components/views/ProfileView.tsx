"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProfile, useLogout } from "@/lib/api";
import { useCalendarConnection } from "@/features/calendar/lib/queries";
import CalendarSyncSettings from "@/features/calendar/components/CalendarSyncSettings";

type ProfileTab = "account" | "calendar-sync";

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "calendar-sync", label: "Calendar Sync" },
];

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 1).toUpperCase();
}

export default function ProfileView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get("section") as ProfileTab) ||
    (searchParams.get("openSettings") === "true" ? "calendar-sync" : "account");
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  const { data: profile, isLoading } = useProfile();
  const logoutMutation = useLogout();

  // Prefetch calendar connection so Calendar Sync tab loads instantly
  useCalendarConnection();

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    router.replace(`?tab=profile&section=${tab}`, { scroll: false });
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-[#FFFCFA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
          <p className="text-[#403770] font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-full bg-[#FFFCFA] flex items-center justify-center">
        <div className="text-center text-[#F37167]">
          <p>Unable to load profile</p>
        </div>
      </div>
    );
  }

  const initials = getInitials(profile.fullName, profile.email);
  const displayName = profile.fullName || profile.email.split("@")[0];

  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2DEEC]">
        <div className="max-w-2xl mx-auto px-6">
          <div className="py-4">
            <h1 className="text-2xl font-bold text-[#403770]">Settings</h1>
            <p className="text-sm text-[#8A80A8] mt-0.5">
              Manage your account and preferences
            </p>
          </div>

          {/* Tabs */}
          <nav className="flex items-center" aria-label="Settings tabs">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`
                    relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors duration-100
                    ${isActive
                      ? "text-[#F37167]"
                      : "text-[#8A80A8] hover:text-[#403770]"
                    }
                  `}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Tab Content */}
      <main className="max-w-2xl mx-auto px-6 py-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-[#D4CFE2] p-5 animate-pulse">
                  <div className="h-4 w-24 bg-[#E2DEEC] rounded mb-4" />
                  <div className="h-3 w-48 bg-[#E2DEEC] rounded mb-2" />
                  <div className="h-3 w-32 bg-[#E2DEEC] rounded" />
                </div>
              ))}
            </div>
          }
        >
          {activeTab === "account" && (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-white rounded-xl border border-[#D4CFE2] p-6">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center bg-[#403770] text-white text-2xl font-medium flex-shrink-0">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-[#403770] truncate">
                      {displayName}
                    </h2>
                    <p className="text-[#8A80A8] truncate">{profile.email}</p>
                    {profile.fullName && (
                      <p className="text-sm text-[#A69DC0] mt-1">
                        Signed in with Google
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign Out */}
              <button
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="w-full flex items-center justify-between bg-white rounded-lg border border-[#D4CFE2] px-4 py-3 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-red-600">
                      {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
                    </p>
                    <p className="text-sm text-[#8A80A8]">Sign out of your account</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {activeTab === "calendar-sync" && (
            <CalendarSyncSettings />
          )}
        </Suspense>
      </main>
    </div>
  );
}
