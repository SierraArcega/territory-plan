"use client";

// LineupView — The Lineup daily-ops tab.
// Shows all activities for a selected day across one or more team members.
// Supports grouping by time, category, plan presence, or district presence.
// Person selector defaults to the logged-in user; teammates can be added via picker.

import { useState, useMemo, useRef, useEffect } from "react";
import {
  useProfile,
  useUsers,
  useTerritoryPlans,
  useActivities,
  type ActivityListItem,
} from "@/lib/api";
import {
  CATEGORY_LABELS,
  type ActivityCategory,
} from "@/features/activities/types";
import { getToday, toDateKey, parseLocalDate } from "@/features/shared/lib/date-utils";
import ActivityRow from "@/features/activities/components/ActivityRow";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import SuggestionsBanner from "./SuggestionsBanner";

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupBy = "time" | "category" | "plan" | "district";

interface ActivityGroup {
  key: string;
  label: string;
  activities: ActivityListItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

function formatDayHeader(dateStr: string): { weekday: string; date: string } {
  const d = parseLocalDate(dateStr);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    date: d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

// Extract local hour (0–23) from an ISO date string
function getHour(dateStr: string): number {
  return new Date(dateStr).getHours();
}

function getUserInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function groupActivities(activities: ActivityListItem[], groupBy: GroupBy): ActivityGroup[] {
  if (groupBy === "time") {
    // Group by hour; activities without a startDate go into a "No time set" bucket
    const byHour = new Map<number, ActivityListItem[]>();
    const noTime: ActivityListItem[] = [];
    for (const a of activities) {
      if (!a.startDate) { noTime.push(a); continue; }
      const h = getHour(a.startDate);
      if (!byHour.has(h)) byHour.set(h, []);
      byHour.get(h)!.push(a);
    }
    const groups: ActivityGroup[] = Array.from(byHour.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, acts]) => ({
        key: String(hour),
        label: formatHourLabel(hour),
        activities: acts,
      }));
    if (noTime.length > 0) {
      groups.push({ key: "no-time", label: "No time set", activities: noTime });
    }
    return groups;
  }

  if (groupBy === "category") {
    const byCategory = new Map<ActivityCategory, ActivityListItem[]>();
    for (const a of activities) {
      if (!byCategory.has(a.category)) byCategory.set(a.category, []);
      byCategory.get(a.category)!.push(a);
    }
    return Array.from(byCategory.entries()).map(([cat, acts]) => ({
      key: cat,
      label: CATEGORY_LABELS[cat],
      activities: acts,
    }));
  }

  if (groupBy === "plan") {
    const withPlan = activities.filter((a) => a.planCount > 0);
    const noPlan = activities.filter((a) => a.planCount === 0);
    const groups: ActivityGroup[] = [];
    if (withPlan.length > 0) groups.push({ key: "has-plan", label: "Linked to a plan", activities: withPlan });
    if (noPlan.length > 0) groups.push({ key: "no-plan", label: "No plan", activities: noPlan });
    return groups;
  }

  // district
  const withDistrict = activities.filter((a) => a.districtCount > 0);
  const noDistrict = activities.filter((a) => a.districtCount === 0);
  const groups: ActivityGroup[] = [];
  if (withDistrict.length > 0) groups.push({ key: "has-district", label: "Linked to districts", activities: withDistrict });
  if (noDistrict.length > 0) groups.push({ key: "no-district", label: "No district", activities: noDistrict });
  return groups;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Avatar chip for person selector bar
function UserChip({
  userId,
  users,
  isCurrentUser,
  onRemove,
}: {
  userId: string;
  users: { id: string; fullName: string | null; avatarUrl: string | null; email: string }[];
  isCurrentUser: boolean;
  onRemove: (id: string) => void;
}) {
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  const initials = getUserInitials(user.fullName, user.email);
  const displayName = user.fullName || user.email;

  return (
    <div className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-[#403770]/10 text-[#403770] text-sm font-medium">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={displayName} className="w-5 h-5 rounded-full object-cover" />
      ) : (
        <span className="w-5 h-5 rounded-full bg-[#403770] text-white text-[10px] flex items-center justify-center font-semibold">
          {initials}
        </span>
      )}
      <span className="max-w-[120px] truncate">{user.fullName || user.email}</span>
      {isCurrentUser && <span className="text-[10px] text-[#403770]/60">(you)</span>}
      <button
        onClick={() => onRemove(userId)}
        className="ml-0.5 text-[#403770]/50 hover:text-[#403770] transition-colors"
        aria-label={`Remove ${displayName}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LineupView() {
  const { data: profile } = useProfile();
  const { data: users = [] } = useUsers();
  const { data: plans = [] } = useTerritoryPlans({ enabled: true });

  // Date navigation
  const [selectedDate, setSelectedDate] = useState<string>(getToday());

  // Person multi-select — starts with the logged-in user once profile loads
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);

  // Seed the person selector once profile is available
  useEffect(() => {
    if (profile?.id && selectedUserIds.length === 0) {
      setSelectedUserIds([profile.id]);
    }
  }, [profile?.id]);

  // Close user picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setShowUserPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Group-by toggle
  const [groupBy, setGroupBy] = useState<GroupBy>("time");

  // Plan filter (client-side, filtered by planCount > 0 since activities don't carry planIds)
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);

  // State filter built from the returned activities' stateAbbrevs
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  // Modal state
  const [editingActivity, setEditingActivity] = useState<ActivityListItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch activities for the selected day and people
  const { data: activitiesData, isLoading } = useActivities({
    startDateFrom: selectedDate,
    startDateTo: selectedDate,
    // Pass selected user IDs so the API filters by assignee
    assignedToUserIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
  });

  // Independent fetch for the current user's own activity count today (used for busy-day detection in the banner).
  // Pinned to getToday() — NOT selectedDate — so it always reflects the real calendar day.
  const today = getToday();
  const { data: myTodayData } = useActivities(
    profile?.id
      ? {
          startDateFrom: today,
          startDateTo: today,
          assignedToUserIds: [profile.id],
        }
      : {}
  );
  const myTodayActivityCount = myTodayData?.activities.length ?? 0;

  const allActivities = activitiesData?.activities ?? [];

  // Derive unique states from current results for the state filter UI
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    for (const a of allActivities) {
      for (const s of a.stateAbbrevs) set.add(s);
    }
    return Array.from(set).sort();
  }, [allActivities]);

  // Apply client-side filters
  const filteredActivities = useMemo(() => {
    let result = allActivities;
    // Plan filter: show only activities that have at least one plan (can't match specific plan IDs
    // without plan IDs on ActivityListItem — filter by presence for now)
    if (selectedPlanIds.length > 0) {
      result = result.filter((a) => a.planCount > 0);
    }
    // State filter: show activities that include any of the selected states
    if (selectedStates.length > 0) {
      result = result.filter((a) =>
        a.stateAbbrevs.some((s) => selectedStates.includes(s))
      );
    }
    return result;
  }, [allActivities, selectedPlanIds, selectedStates]);

  const groups = useMemo(
    () => groupActivities(filteredActivities, groupBy),
    [filteredActivities, groupBy]
  );

  const { weekday, date } = formatDayHeader(selectedDate);
  const isToday = selectedDate === getToday();

  // Users not yet in the person selector
  const addableUsers = users.filter((u) => !selectedUserIds.includes(u.id));

  const handleRemoveUser = (id: string) => {
    // Keep at least one person selected
    if (selectedUserIds.length <= 1) return;
    setSelectedUserIds((prev) => prev.filter((uid) => uid !== id));
  };

  const handleAddUser = (id: string) => {
    setSelectedUserIds((prev) => [...prev, id]);
    setShowUserPicker(false);
  };

  const handleOpenEdit = (activity: ActivityListItem) => {
    setEditingActivity(activity);
  };

  const handleCloseModal = () => {
    setEditingActivity(null);
    setIsCreating(false);
  };

  const togglePlanFilter = (planId: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const toggleStateFilter = (state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

  const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "time", label: "Time" },
    { value: "category", label: "Category" },
    { value: "plan", label: "Plan" },
    { value: "district", label: "District" },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">

      {/* ── Date header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Previous day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold text-[#403770]">{weekday}</h1>
              {isToday && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#403770] text-white">
                  Today
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{date}</p>
          </div>

          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Next day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ── Person selector bar ── */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {selectedUserIds.map((uid) => (
            <UserChip
              key={uid}
              userId={uid}
              users={users}
              isCurrentUser={uid === profile?.id}
              onRemove={handleRemoveUser}
            />
          ))}

          {/* Add person button + picker */}
          {addableUsers.length > 0 && (
            <div className="relative" ref={userPickerRef}>
              <button
                onClick={() => setShowUserPicker((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-[#403770] hover:text-[#403770] text-sm transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add person
              </button>

              {showUserPicker && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1 max-h-48 overflow-y-auto">
                  {addableUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleAddUser(u.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                    >
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-[#403770] text-white text-[10px] flex items-center justify-center font-semibold flex-shrink-0">
                          {getUserInitials(u.fullName, u.email)}
                        </span>
                      )}
                      <span className="text-sm text-gray-700 truncate">{u.fullName || u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Toolbar: New Activity + Group-by + Filters ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Activity
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200" />

        {/* Group-by toggle */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Group by</span>
          {GROUP_BY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGroupBy(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                groupBy === opt.value
                  ? "bg-[#403770] text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Plan filter chips */}
        {plans.length > 0 && (
          <>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500">Plan</span>
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => togglePlanFilter(plan.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                    selectedPlanIds.includes(plan.id)
                      ? "border-transparent text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                  style={
                    selectedPlanIds.includes(plan.id)
                      ? { backgroundColor: plan.color }
                      : {}
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedPlanIds.includes(plan.id) ? "rgba(255,255,255,0.7)" : plan.color }}
                  />
                  {plan.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* State filter chips (built from current results) */}
        {availableStates.length > 0 && (
          <>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-gray-500">State</span>
              {availableStates.map((state) => (
                <button
                  key={state}
                  onClick={() => toggleStateFilter(state)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                    selectedStates.includes(state)
                      ? "bg-[#403770] text-white border-transparent"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Clear filters button */}
        {(selectedPlanIds.length > 0 || selectedStates.length > 0) && (
          <button
            onClick={() => { setSelectedPlanIds([]); setSelectedStates([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Activity timeline ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* ── Suggestions banner (shown only when viewing today) ── */}
        <SuggestionsBanner
          date={selectedDate}
          activityCount={myTodayActivityCount}
        />
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Loading activities...
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-gray-400 text-sm">No activities for this day.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-3 text-sm text-[#403770] hover:underline"
            >
              Add one
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.activities.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      onOpen={handleOpenEdit}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ActivityFormModal (create + edit) ── */}
      <ActivityFormModal
        isOpen={isCreating || !!editingActivity}
        onClose={handleCloseModal}
        initialData={editingActivity}
        defaultPlanId={undefined}
      />
    </div>
  );
}
