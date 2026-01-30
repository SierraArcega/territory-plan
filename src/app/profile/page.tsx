"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useProfile,
  useUpdateProfile,
  useUpsertUserGoal,
  useDeleteUserGoal,
  UserGoal,
} from "@/lib/api";
import GoalProgress from "@/components/user/GoalProgress";
import GoalFormModal, { GoalFormData } from "@/components/user/GoalFormModal";

// Generate initials from a name
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

export default function ProfilePage() {
  const { data: profile, isLoading, error } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const upsertGoalMutation = useUpsertUserGoal();
  const deleteGoalMutation = useDeleteUserGoal();

  // Modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Partial<UserGoal> | null>(null);
  const [isNewGoal, setIsNewGoal] = useState(false);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFCFA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
          <p className="text-[#403770] font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#FFFCFA] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load profile</p>
          <Link
            href="/"
            className="text-[#403770] hover:text-[#F37167] font-medium"
          >
            Go back to map
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.fullName || profile.email.split("@")[0];
  const initials = getInitials(profile.fullName, profile.email);

  // Handle opening goal edit modal
  const handleEditGoal = (goal: UserGoal) => {
    setEditingGoal(goal);
    setIsNewGoal(false);
    setIsGoalModalOpen(true);
  };

  // Handle opening new goal modal
  const handleAddGoal = () => {
    setEditingGoal(null);
    setIsNewGoal(true);
    setIsGoalModalOpen(true);
  };

  // Handle goal form submission
  const handleGoalSubmit = async (data: GoalFormData) => {
    await upsertGoalMutation.mutateAsync(data);
  };

  // Handle goal deletion
  const handleDeleteGoal = async (fiscalYear: number) => {
    if (confirm(`Are you sure you want to delete your FY${fiscalYear.toString().slice(-2)} goals?`)) {
      await deleteGoalMutation.mutateAsync(fiscalYear);
    }
  };

  // Handle profile name edit
  const handleSaveName = async () => {
    await updateProfileMutation.mutateAsync({ fullName: editName });
    setIsEditingProfile(false);
  };

  const handleStartEditName = () => {
    setEditName(profile.fullName || "");
    setIsEditingProfile(true);
  };

  return (
    <div className="min-h-screen bg-[#FFFCFA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#403770] hover:text-[#F37167] font-medium transition-colors"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Map
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#403770]">Profile</h2>
            {!isEditingProfile && (
              <button
                onClick={handleStartEditName}
                className="text-sm text-[#403770] hover:text-[#F37167] font-medium transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-full overflow-hidden flex items-center justify-center bg-[#403770] text-white text-xl font-medium flex-shrink-0">
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

            {/* Name and Email */}
            <div className="flex-1 min-w-0">
              {isEditingProfile ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your name"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={updateProfileMutation.isPending}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-lg font-medium text-[#403770] truncate">
                    {displayName}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{profile.email}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Goals Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[#403770]">My Goals</h2>
            <button
              onClick={handleAddGoal}
              className="flex items-center gap-1.5 text-sm text-[#403770] hover:text-[#F37167] font-medium transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Year
            </button>
          </div>

          {profile.goals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                You haven&apos;t set any goals yet.
              </p>
              <button
                onClick={handleAddGoal}
                className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors"
              >
                Set Your First Goal
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {profile.goals.map((goal) => (
                <div key={goal.id} className="space-y-4">
                  {/* Year Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-medium text-[#403770]">
                      FY{goal.fiscalYear.toString().slice(-2)} Goals
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditGoal(goal)}
                        className="text-xs text-[#403770] hover:text-[#F37167] font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => handleDeleteGoal(goal.fiscalYear)}
                        disabled={deleteGoalMutation.isPending}
                        className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Progress Bars */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <GoalProgress
                      label="Revenue"
                      actual={goal.revenueActual}
                      target={goal.revenueTarget}
                    />
                    <GoalProgress
                      label="Take (Margin)"
                      actual={goal.takeActual}
                      target={goal.takeTarget}
                    />
                    <GoalProgress
                      label="Pipeline"
                      actual={goal.pipelineActual}
                      target={goal.pipelineTarget}
                    />
                    <GoalProgress
                      label="New Districts"
                      actual={goal.newDistrictsActual}
                      target={goal.newDistrictsTarget}
                      isCurrency={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center text-sm text-gray-500">
          <p>
            Your progress is calculated from districts in your territory plans.
          </p>
          <p className="mt-1">
            Add districts to your plans to see your actual progress toward goals.
          </p>
        </div>
      </div>

      {/* Goal Edit Modal */}
      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => {
          setIsGoalModalOpen(false);
          setEditingGoal(null);
        }}
        onSubmit={handleGoalSubmit}
        initialData={editingGoal || undefined}
        title={isNewGoal ? "Add Goals" : `Edit FY${editingGoal?.fiscalYear?.toString().slice(-2) || ""} Goals`}
        isNewGoal={isNewGoal}
      />
    </div>
  );
}
