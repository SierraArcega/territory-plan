"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  useProfile,
  useUpdateProfile,
  useTerritoryPlans,
  useGoalDashboard,
} from "@/lib/api";
import { useMapV2Store } from "@/features/map/lib/store";
import { searchLocations, type GeocodeSuggestion } from "@/features/map/lib/geocode";
import { getDefaultFiscalYear, formatCurrency } from "@/features/goals/components/ProgressCard";
import GoalEditorModal from "@/features/goals/components/GoalEditorModal";

const FISCAL_YEARS = [2026, 2027, 2028, 2029];

// ============================================================================
// HomePanel
// ============================================================================

export default function HomePanel() {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    jobTitle: "",
    location: "",
    locationLat: null as number | null,
    locationLng: null as number | null,
    phone: "",
    slackUrl: "",
    bio: "",
  });
  const [locationSuggestions, setLocationSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationInputRef = useRef<HTMLDivElement>(null);

  const [selectedFY, setSelectedFY] = useState(2027);

  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: plans } = useTerritoryPlans();
  const { data: dashboard } = useGoalDashboard(selectedFY);

  const viewPlan = useMapV2Store((s) => s.viewPlan);
  const startNewPlan = useMapV2Store((s) => s.startNewPlan);

  // Filter plans by selected FY
  const fyPlans = useMemo(
    () => plans?.filter((p) => p.fiscalYear === selectedFY) || [],
    [plans, selectedFY],
  );

  // Goal metrics for selected FY
  const goalMetrics = useMemo(() => {
    if (!dashboard?.goals) return null;
    const g = dashboard.goals;
    const a = dashboard.actuals;
    const totalTarget =
      (g.renewalTarget || 0) +
      (g.winbackTarget || 0) +
      (g.expansionTarget || 0) +
      (g.newBusinessTarget || 0);
    const totalCurrent = a.revenue + a.pipeline;
    return [
      { label: "Earnings", current: a.earnings, target: g.earningsTarget, color: "#F37167", format: "currency" as const },
      { label: "Take", current: a.take, target: g.takeTarget, color: "#6EA3BE", format: "currency" as const },
      { label: "Total Target", current: totalCurrent, target: totalTarget || null, color: "#403770", format: "currency" as const },
      { label: "New Districts", current: a.newDistricts, target: g.newDistrictsTarget, color: "#403770", format: "number" as const },
    ];
  }, [dashboard]);

  // --- Edit handlers ---

  const startEditing = () => {
    setEditForm({
      fullName: profile?.fullName || "",
      jobTitle: profile?.jobTitle || "",
      location: profile?.location || "",
      locationLat: profile?.locationLat ?? null,
      locationLng: profile?.locationLng ?? null,
      phone: profile?.phone || "",
      slackUrl: profile?.slackUrl || "",
      bio: profile?.bio || "",
    });
    setLocationSuggestions([]);
    setShowLocationDropdown(false);
    setEditing(true);
  };

  const saveProfile = () => {
    const data: Parameters<typeof updateProfile.mutate>[0] = {
      fullName: editForm.fullName || undefined,
      jobTitle: editForm.jobTitle || undefined,
      location: editForm.location || undefined,
      phone: editForm.phone || undefined,
      slackUrl: editForm.slackUrl || undefined,
      bio: editForm.bio || undefined,
    };

    if (editForm.locationLat != null && editForm.locationLng != null) {
      data.locationLat = editForm.locationLat;
      data.locationLng = editForm.locationLng;
    } else if (!editForm.location) {
      data.locationLat = null;
      data.locationLng = null;
    }

    updateProfile.mutate(data, { onSuccess: () => setEditing(false) });
  };

  const handleLocationInput = useCallback((value: string) => {
    setEditForm((f) => ({ ...f, location: value, locationLat: null, locationLng: null }));
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (value.trim().length < 2) {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      return;
    }
    locationDebounceRef.current = setTimeout(async () => {
      const results = await searchLocations(value);
      setLocationSuggestions(results);
      setShowLocationDropdown(results.length > 0);
    }, 350);
  }, []);

  const selectLocationSuggestion = useCallback((suggestion: GeocodeSuggestion) => {
    const parts = suggestion.displayName.split(", ");
    const shortName = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : suggestion.displayName;
    setEditForm((f) => ({
      ...f,
      location: shortName,
      locationLat: suggestion.lat,
      locationLng: suggestion.lng,
    }));
    setShowLocationDropdown(false);
    setLocationSuggestions([]);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (locationInputRef.current && !locationInputRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [avatarError, setAvatarError] = useState(false);
  const [showGoalEditor, setShowGoalEditor] = useState(false);

  const initials = profile
    ? (() => {
        const name = profile.fullName;
        if (name) {
          const parts = name.split(" ").filter(Boolean);
          if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
          return name.substring(0, 2).toUpperCase();
        }
        return profile.email.substring(0, 1).toUpperCase();
      })()
    : "?";

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div>
      {/* ── Profile card with banner background ── */}
      <div className="relative overflow-hidden px-4 pb-3 pt-4 bg-plum">
        {/* Content — sits on top of the banner */}
        <div className="relative z-[1]">
          {/* Avatar + edit */}
          <div className="flex items-start justify-between">
            {profile?.avatarUrl && !avatarError ? (
              <img
                src={profile.avatarUrl}
                alt=""
                onError={() => setAvatarError(true)}
                className="w-11 h-11 rounded-full object-cover ring-[2.5px] ring-white/30 shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white ring-[2.5px] ring-white/30 shadow-md flex-shrink-0">
                {initials}
              </div>
            )}

            <button
              onClick={startEditing}
              className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all group"
              title="Edit profile"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 11 11"
                fill="none"
                className="text-white/50 group-hover:text-white/80 transition-colors"
              >
                <path
                  d="M7.5 1.5L9.5 3.5M1 10L1.5 7.5L8.5 0.5L10.5 2.5L3.5 9.5L1 10Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* Name + title */}
          <div className="mt-2">
            <h2 className="text-sm font-semibold text-white leading-tight">
              {profile?.fullName || "Your Name"}
            </h2>
            {profile?.jobTitle && (
              <p className="text-[11px] text-white/60 mt-0.5">{profile.jobTitle}</p>
            )}
          </div>

          {/* Detail links */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {profile?.location && (
              <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-white/10 text-[10px] text-white/70">
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                  <path
                    d="M5 1C3.34 1 2 2.34 2 4C2 6.25 5 9 5 9S8 6.25 8 4C8 2.34 6.66 1 5 1Z"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <circle cx="5" cy="4" r="1" stroke="currentColor" strokeWidth="1" />
                </svg>
                {profile.location}
              </span>
            )}
            {profile?.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-white/10 text-[10px] text-white/70 hover:bg-white/20 hover:text-white transition-colors"
              >
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                  <path
                    d="M6.5 6.5C5.8 7.2 4.5 6.5 3 5S1.8 2.2 2.5 1.5L3.2 2.2C3.5 2.5 3.5 3 3.2 3.2L2.8 3.6C2.8 3.6 3.5 5 4.2 5.8C5 6.5 6.4 7.2 6.4 7.2L6.8 6.8C7 6.5 7.5 6.5 7.8 6.8L8.5 7.5L6.5 6.5Z"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                </svg>
                {profile.phone}
              </a>
            )}
            {profile?.slackUrl && (
              <a
                href={profile.slackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-white/10 text-[10px] text-white/70 hover:bg-white/20 hover:text-white transition-colors"
              >
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className="flex-shrink-0">
                  <path
                    d="M2.5 6C2.5 6.55 2.05 7 1.5 7S.5 6.55.5 6 .95 5 1.5 5H2.5V6ZM3 6C3 5.45 3.45 5 4 5S5 5.45 5 6V8.5C5 9.05 4.55 9.5 4 9.5S3 9.05 3 8.5V6ZM4 2.5C3.45 2.5 3 2.05 3 1.5S3.45.5 4 .5 5 .95 5 1.5V2.5H4ZM4 3C4.55 3 5 3.45 5 4S4.55 5 4 5H1.5C.95 5 .5 4.55.5 4S.95 3 1.5 3H4ZM7.5 4C7.5 3.45 7.95 3 8.5 3S9.5 3.45 9.5 4 9.05 5 8.5 5H7.5V4ZM7 4C7 4.55 6.55 5 6 5S5 4.55 5 4V1.5C5 .95 5.45.5 6 .5S7 .95 7 1.5V4ZM6 7.5C6.55 7.5 7 7.95 7 8.5S6.55 9.5 6 9.5 5 9.05 5 8.5V7.5H6ZM6 7C5.45 7 5 6.55 5 6S5.45 5 6 5H8.5C9.05 5 9.5 5.45 9.5 6S9.05 7 8.5 7H6Z"
                    fill="currentColor"
                  />
                </svg>
                Slack
              </a>
            )}
            {!profile?.jobTitle && !profile?.location && !profile?.phone && (
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full border border-dashed border-white/20 text-[10px] text-white/50 hover:text-white/80 hover:border-white/40 transition-colors"
              >
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path d="M5 2V8M2 5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Add details
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit form (slide-down) ── */}
      {editing && (
        <div className="mx-3 mt-2.5 rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Edit Profile
            </p>
            <button
              onClick={() => setEditing(false)}
              className="w-5 h-5 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <EditField
            label="Name"
            value={editForm.fullName}
            onChange={(v) => setEditForm((f) => ({ ...f, fullName: v }))}
            placeholder="Your full name"
          />
          <EditField
            label="Title"
            value={editForm.jobTitle}
            onChange={(v) => setEditForm((f) => ({ ...f, jobTitle: v }))}
            placeholder="e.g. Territory Sales Rep"
          />

          <div ref={locationInputRef} className="relative">
            <EditField
              label="Location"
              value={editForm.location}
              onChange={handleLocationInput}
              onFocus={() =>
                locationSuggestions.length > 0 && setShowLocationDropdown(true)
              }
              placeholder="e.g. Austin, TX"
              trailing={
                editForm.locationLat ? (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none" className="text-green-400">
                    <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null
              }
            />
            {showLocationDropdown && locationSuggestions.length > 0 && (
              <div className="absolute z-50 mt-0.5 w-full rounded-lg bg-white border border-gray-200 shadow-lg overflow-hidden">
                {locationSuggestions.map((s, i) => {
                  const parts = s.displayName.split(", ");
                  const label = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : s.displayName;
                  return (
                    <button
                      key={i}
                      onClick={() => selectLocationSuggestion(s)}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                    >
                      <span className="font-medium">{label}</span>
                      {parts.length > 2 && (
                        <span className="block text-[10px] text-gray-400 truncate">
                          {parts.slice(2).join(", ")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <EditField
            label="Phone"
            value={editForm.phone}
            onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
            placeholder="(512) 555-1234"
            type="tel"
          />
          <EditField
            label="Slack"
            value={editForm.slackUrl}
            onChange={(v) => setEditForm((f) => ({ ...f, slackUrl: v }))}
            placeholder="https://slack.com/team/..."
            type="url"
          />

          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
              Bio
            </label>
            <textarea
              value={editForm.bio}
              onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="A short note about yourself..."
              rows={2}
              className="w-full mt-0.5 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-plum/30 focus:ring-1 focus:ring-plum/10 transition-all resize-none"
            />
          </div>

          <button
            onClick={saveProfile}
            disabled={updateProfile.isPending}
            className="w-full py-1.5 text-xs font-semibold bg-plum text-white rounded-lg hover:bg-plum/90 transition-colors disabled:opacity-50"
          >
            {updateProfile.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {/* ── FY Tabs ── */}
      <div className="px-4 mt-3">
        <div className="flex gap-0.5">
          {FISCAL_YEARS.map((fy) => (
            <button
              key={fy}
              onClick={() => setSelectedFY(fy)}
              className={`
                flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors
                ${selectedFY === fy
                  ? "bg-plum text-white"
                  : "text-gray-400 hover:text-plum hover:bg-gray-50"
                }
              `}
            >
              FY{String(fy).slice(-2)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Goals ── */}
      <div className="px-4 mt-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Goals
          </h3>
          <button
            onClick={() => setShowGoalEditor(true)}
            className="text-[10px] text-gray-400 hover:text-plum transition-colors"
          >
            {dashboard?.goals ? "Edit" : "Set goals"}
          </button>
        </div>
        {goalMetrics ? (
          <div className="space-y-2.5">
            {goalMetrics.map((m) => {
              const pct =
                m.target && m.target > 0
                  ? Math.min((m.current / m.target) * 100, 100)
                  : 0;
              const currentFmt =
                m.format === "currency"
                  ? formatCurrency(m.current, true)
                  : m.current.toLocaleString();
              const targetFmt =
                m.format === "currency"
                  ? formatCurrency(m.target, true)
                  : m.target?.toLocaleString() || "-";
              return (
                <div key={m.label}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] font-medium text-gray-500">
                      {m.label}
                    </span>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {currentFmt}
                      <span className="text-gray-300"> / {targetFmt}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: m.color,
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-semibold tabular-nums w-7 text-right"
                      style={{ color: m.color }}
                    >
                      {Math.round(pct)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 py-4 text-center">
            <p className="text-[11px] text-gray-400">
              No goals set for FY{String(selectedFY).slice(-2)}
            </p>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-gray-100 mx-4 mt-3" />

      {/* ── Plans for selected FY ── */}
      <div className="px-4 mt-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Plans
          </h3>
          <span className="text-[10px] text-gray-300">{fyPlans.length}</span>
        </div>
        {fyPlans.length === 0 ? (
          <div className="rounded-lg bg-gray-50 py-4 text-center">
            <p className="text-[11px] text-gray-400">
              No plans for FY{String(selectedFY).slice(-2)}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {fyPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => viewPlan(plan.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: plan.color }}
                />
                <span className="text-xs text-plum truncate flex-1 group-hover:text-plum/80">
                  {plan.name}
                </span>
                <span className="text-[10px] text-gray-300 tabular-nums">
                  {plan.districtCount}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={startNewPlan}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 mt-1 rounded-lg border border-dashed border-gray-200 hover:border-coral hover:bg-coral/5 transition-all text-left group"
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 12 12"
            fill="none"
            className="text-gray-300 group-hover:text-coral transition-colors flex-shrink-0"
          >
            <path
              d="M6 2V10M2 6H10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[11px] text-gray-400 group-hover:text-coral transition-colors">
            New plan
          </span>
        </button>
      </div>

      {/* ── Goal Editor Modal ── */}
      <GoalEditorModal
        isOpen={showGoalEditor}
        onClose={() => setShowGoalEditor(false)}
        fiscalYear={selectedFY}
        currentGoals={dashboard?.goals || null}
      />
    </div>
  );
}

// ============================================================================
// EditField (compact form field)
// ============================================================================

function EditField({
  label,
  value,
  onChange,
  onFocus,
  placeholder,
  type = "text",
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  type?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <label className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="w-full mt-0.5 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-plum/30 focus:ring-1 focus:ring-plum/10 transition-all"
      />
      {trailing && (
        <div className="absolute right-2.5 top-[22px]">{trailing}</div>
      )}
    </div>
  );
}
