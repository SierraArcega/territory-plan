// OutcomeModal — Shown when an activity is completed (from table or calendar confirm).
// Section A: Category-specific outcome pills + optional note
// Section B: Optional follow-up activity and/or follow-up task creation
// Section C: Skip / Save actions

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  useUpdateActivity,
  useCreateActivity,
  useCreateTask,
} from "@/lib/api";
import { useCreateContact } from "@/features/shared/lib/queries";
import {
  getCategoryForType,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_CATEGORIES,
  type ActivityType,
  type ActivityCategory,
} from "@/features/activities/types";
import {
  OUTCOMES_BY_CATEGORY,
  OUTCOME_CONFIGS,
  type OutcomeType,
} from "@/features/activities/outcome-types";

interface OutcomeModalProps {
  activity: { id: string; type: string; title: string };
  sourceContext?: {
    planIds?: string[];
    districtLeaids?: string[];
    contactIds?: number[];
  };
  onClose: () => void;
}

export default function OutcomeModal({
  activity,
  sourceContext,
  onClose,
}: OutcomeModalProps) {
  // Section A state
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeType | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  // Section B state — follow-up activity
  const [showFollowUpActivity, setShowFollowUpActivity] = useState(false);
  const [fuActivityTitle, setFuActivityTitle] = useState(`Follow-up: ${activity.title}`);
  const [fuActivityType, setFuActivityType] = useState<ActivityType>(
    (activity.type as ActivityType) || "customer_check_in"
  );
  const [fuActivityDate, setFuActivityDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });

  // Section B state — follow-up task
  const [showFollowUpTask, setShowFollowUpTask] = useState(false);
  const [fuTaskTitle, setFuTaskTitle] = useState(`Follow up on: ${activity.title}`);
  const [fuTaskPriority, setFuTaskPriority] = useState<"high" | "medium" | "low">("high");
  const [fuTaskDueDate, setFuTaskDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });

  // Section B state — new contact
  const [showNewContact, setShowNewContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactDistrict, setContactDistrict] = useState<{ leaid: string; name: string } | null>(
    sourceContext?.districtLeaids?.[0] ? { leaid: sourceContext.districtLeaids[0], name: "" } : null
  );
  const [districtSearch, setDistrictSearch] = useState("");
  const [districtResults, setDistrictResults] = useState<{ leaid: string; name: string; stateAbbrev: string }[]>([]);
  const [showDistrictResults, setShowDistrictResults] = useState(false);
  const districtSearchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleDistrictSearch = useCallback((query: string) => {
    setDistrictSearch(query);
    setContactDistrict(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 2) {
      setDistrictResults([]);
      setShowDistrictResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/districts?search=${encodeURIComponent(query)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setDistrictResults(data.districts || []);
          setShowDistrictResults(true);
        }
      } catch { /* ignore */ }
    }, 250);
  }, []);

  useEffect(() => {
    if (!showDistrictResults) return;
    function handleClick(e: MouseEvent) {
      if (districtSearchRef.current && !districtSearchRef.current.contains(e.target as Node)) {
        setShowDistrictResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDistrictResults]);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  const updateActivity = useUpdateActivity();
  const createActivity = useCreateActivity();
  const createTask = useCreateTask();
  const createContact = useCreateContact();

  const category = getCategoryForType(activity.type as ActivityType);
  const outcomes = OUTCOMES_BY_CATEGORY[category];

  // Build type options for the follow-up activity dropdown
  const activityTypeOptions = Object.entries(ACTIVITY_CATEGORIES).flatMap(
    ([, types]) => types.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t] }))
  );

  const handleSave = async () => {
    if (!selectedOutcome) return;
    setIsSaving(true);

    try {
      const config = OUTCOME_CONFIGS[selectedOutcome];

      // 1. Save outcome to the activity
      await updateActivity.mutateAsync({
        activityId: activity.id,
        outcomeType: selectedOutcome,
        outcome: note.trim() || null,
      });

      // 2. Auto-task from outcome config (existing pattern)
      if (config.autoTask) {
        const isFollowUp = config.autoTask === "follow_up";
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (isFollowUp ? 3 : 7));

        await createTask.mutateAsync({
          title: isFollowUp
            ? `Follow up: ${activity.title}`
            : `Prep for meeting: ${activity.title}`,
          description: note.trim()
            ? `Auto-created from outcome "${config.label}" \u2014 ${note.trim()}`
            : `Auto-created from outcome "${config.label}" on activity "${activity.title}"`,
          priority: isFollowUp ? "high" : "medium",
          dueDate: dueDate.toISOString(),
          activityIds: [activity.id],
          planIds: sourceContext?.planIds,
          leaids: sourceContext?.districtLeaids,
          contactIds: sourceContext?.contactIds,
        });
      }

      // 3. Follow-up activity if toggled on
      if (showFollowUpActivity && fuActivityTitle.trim()) {
        await createActivity.mutateAsync({
          type: fuActivityType,
          title: fuActivityTitle.trim(),
          startDate: fuActivityDate || null,
          status: "planned",
          planIds: sourceContext?.planIds,
          districtLeaids: sourceContext?.districtLeaids,
          contactIds: sourceContext?.contactIds,
        });
      }

      // 4. Follow-up task if toggled on
      if (showFollowUpTask && fuTaskTitle.trim()) {
        await createTask.mutateAsync({
          title: fuTaskTitle.trim(),
          description: `Follow-up task created from "${activity.title}"`,
          priority: fuTaskPriority,
          dueDate: fuTaskDueDate ? new Date(fuTaskDueDate).toISOString() : null,
          activityIds: [activity.id],
          planIds: sourceContext?.planIds,
          leaids: sourceContext?.districtLeaids,
          contactIds: sourceContext?.contactIds,
        });
      }

      // 5. New contact if toggled on
      if (showNewContact && contactName.trim() && contactDistrict) {
        await createContact.mutateAsync({
          leaid: contactDistrict.leaid,
          name: contactName.trim(),
          ...(contactTitle.trim() && { title: contactTitle.trim() }),
          ...(contactEmail.trim() && { email: contactEmail.trim() }),
          ...(contactPhone.trim() && { phone: contactPhone.trim() }),
        });
      }

      onClose();
    } catch {
      // Let mutation error states surface in the UI
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle =
    "w-full px-3 py-2 text-sm font-medium border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral bg-white text-[#403770] placeholder:text-[#A69DC0]";
  const labelStyle =
    "block text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1.5";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Modal card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
            <div>
              <h2 className="text-lg font-bold text-plum">What happened?</h2>
              <p className="text-xs font-medium text-[#8A80A8] mt-0.5 truncate max-w-[280px]">
                {activity.title}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-[#A69DC0] hover:text-plum hover:bg-[#EFEDF5] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Section A — Outcome Selection */}
            <div>
              <p className={labelStyle}>How did it go?</p>
              <div className="flex flex-wrap gap-2">
                {outcomes.map((outcomeType) => {
                  const config = OUTCOME_CONFIGS[outcomeType];
                  const isSelected = selectedOutcome === outcomeType;

                  return (
                    <button
                      key={outcomeType}
                      onClick={() =>
                        setSelectedOutcome(isSelected ? null : outcomeType)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? config.color : config.bgColor,
                        color: isSelected ? "#fff" : config.color,
                        boxShadow: isSelected
                          ? `0 0 0 2px ${config.color}40`
                          : "none",
                      }}
                    >
                      <span className="text-sm">{config.icon}</span>
                      {config.label}
                    </button>
                  );
                })}
              </div>

              {/* Description hint for selected outcome */}
              {selectedOutcome && (
                <p className="mt-2 text-xs font-medium text-[#8A80A8]">
                  {OUTCOME_CONFIGS[selectedOutcome].description}
                </p>
              )}

              {/* Auto-task hint */}
              {selectedOutcome && OUTCOME_CONFIGS[selectedOutcome].autoTask && (
                <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#e8f1f5]">
                  <svg className="w-3 h-3 text-steel-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[11px] font-medium text-steel-blue">
                    Auto-creates a{" "}
                    {OUTCOME_CONFIGS[selectedOutcome].autoTask === "follow_up"
                      ? "follow-up task"
                      : "prep task"}
                  </span>
                </div>
              )}

              {/* Quick note */}
              {!showNote ? (
                <button
                  onClick={() => setShowNote(true)}
                  className="mt-3 text-xs font-medium text-[#A69DC0] hover:text-plum transition-colors cursor-pointer"
                >
                  + Add notes or details
                </button>
              ) : (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Key takeaways, leads, next steps..."
                  rows={3}
                  autoFocus
                  className={`mt-3 ${inputStyle} resize-none`}
                />
              )}
            </div>

            {/* Section B — Follow-up Creation */}
            <div className="space-y-3">
              <p className={labelStyle}>Follow-ups</p>

              {/* Follow-up Activity toggle */}
              <div className="border border-[#D4CFE2] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFollowUpActivity(!showFollowUpActivity)}
                  className="w-full flex items-center justify-between px-3.5 py-3 text-sm text-left hover:bg-[#F7F5FA] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#EEEAF5] text-plum">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <span className="font-medium text-[#544A78]">Schedule follow-up activity</span>
                  </span>
                  <div
                    className={`w-8 h-[18px] rounded-full transition-colors relative ${
                      showFollowUpActivity ? "bg-plum" : "bg-[#D4CFE2]"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                        showFollowUpActivity ? "translate-x-[16px]" : "translate-x-[2px]"
                      }`}
                    />
                  </div>
                </button>

                {showFollowUpActivity && (
                  <div className="border-t border-[#E2DEEC] px-3.5 py-3.5 space-y-3 bg-[#F7F5FA]">
                    <div>
                      <label className={labelStyle}>Title</label>
                      <input
                        type="text"
                        value={fuActivityTitle}
                        onChange={(e) => setFuActivityTitle(e.target.value)}
                        className={inputStyle}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelStyle}>Type</label>
                        <select
                          value={fuActivityType}
                          onChange={(e) => setFuActivityType(e.target.value as ActivityType)}
                          className={inputStyle}
                        >
                          {activityTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelStyle}>Date</label>
                        <input
                          type="date"
                          value={fuActivityDate}
                          onChange={(e) => setFuActivityDate(e.target.value)}
                          className={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Follow-up Task toggle */}
              <div className="border border-[#D4CFE2] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFollowUpTask(!showFollowUpTask)}
                  className="w-full flex items-center justify-between px-3.5 py-3 text-sm text-left hover:bg-[#F7F5FA] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#F7FFF2] text-[#69B34A]">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="font-medium text-[#544A78]">Create follow-up task</span>
                  </span>
                  <div
                    className={`w-8 h-[18px] rounded-full transition-colors relative ${
                      showFollowUpTask ? "bg-plum" : "bg-[#D4CFE2]"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                        showFollowUpTask ? "translate-x-[16px]" : "translate-x-[2px]"
                      }`}
                    />
                  </div>
                </button>

                {showFollowUpTask && (
                  <div className="border-t border-[#E2DEEC] px-3.5 py-3.5 space-y-3 bg-[#F7F5FA]">
                    <div>
                      <label className={labelStyle}>Title</label>
                      <input
                        type="text"
                        value={fuTaskTitle}
                        onChange={(e) => setFuTaskTitle(e.target.value)}
                        className={inputStyle}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelStyle}>Priority</label>
                        <select
                          value={fuTaskPriority}
                          onChange={(e) => setFuTaskPriority(e.target.value as "high" | "medium" | "low")}
                          className={inputStyle}
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelStyle}>Due Date</label>
                        <input
                          type="date"
                          value={fuTaskDueDate}
                          onChange={(e) => setFuTaskDueDate(e.target.value)}
                          className={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* New Contact toggle */}
              <div className="border border-[#D4CFE2] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowNewContact(!showNewContact)}
                  className="w-full flex items-center justify-between px-3.5 py-3 text-sm text-left hover:bg-[#F7F5FA] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#FEF2F1] text-coral">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </span>
                    <span className="font-medium text-[#544A78]">Add new contact</span>
                  </span>
                  <div
                    className={`w-8 h-[18px] rounded-full transition-colors relative ${
                      showNewContact ? "bg-plum" : "bg-[#D4CFE2]"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
                        showNewContact ? "translate-x-[16px]" : "translate-x-[2px]"
                      }`}
                    />
                  </div>
                </button>

                {showNewContact && (
                  <div className="border-t border-[#E2DEEC] px-3.5 py-3.5 space-y-3 bg-[#F7F5FA]">
                    {/* District search */}
                    <div ref={districtSearchRef} className="relative">
                      <label className={labelStyle}>District</label>
                      {contactDistrict ? (
                        <div className="flex items-center justify-between px-3 py-2 border border-[#C2BBD4] rounded-lg bg-white">
                          <span className="text-sm font-medium text-plum truncate">{contactDistrict.name}</span>
                          <button
                            onClick={() => { setContactDistrict(null); setDistrictSearch(""); }}
                            className="text-[#A69DC0] hover:text-plum ml-2 shrink-0 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={districtSearch}
                          onChange={(e) => handleDistrictSearch(e.target.value)}
                          placeholder="Search by district name (optional)"
                          className={inputStyle}
                        />
                      )}
                      {showDistrictResults && districtResults.length > 0 && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-[#D4CFE2] rounded-xl shadow-lg max-h-[160px] overflow-y-auto">
                          {districtResults.map((d) => (
                            <button
                              key={d.leaid}
                              onClick={() => {
                                setContactDistrict({ leaid: d.leaid, name: d.name });
                                setDistrictSearch(d.name);
                                setShowDistrictResults(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#F7F5FA] transition-colors cursor-pointer"
                            >
                              <span className="text-sm font-medium text-plum">{d.name}</span>
                              <span className="text-xs text-[#8A80A8] ml-1.5">{d.stateAbbrev}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelStyle}>Name *</label>
                        <input
                          type="text"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Jane Smith"
                          className={inputStyle}
                        />
                      </div>
                      <div>
                        <label className={labelStyle}>Title</label>
                        <input
                          type="text"
                          value={contactTitle}
                          onChange={(e) => setContactTitle(e.target.value)}
                          placeholder="Director of SPED"
                          className={inputStyle}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelStyle}>Email</label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="jane@district.org"
                          className={inputStyle}
                        />
                      </div>
                      <div>
                        <label className={labelStyle}>Phone</label>
                        <input
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          className={inputStyle}
                        />
                      </div>
                    </div>
                    {!contactDistrict && contactName.trim() && (
                      <p className="text-[11px] font-medium text-[#8A80A8]">
                        No district selected — contact will be saved when you pick one
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section C — Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#E2DEEC]">
            <button
              onClick={onClose}
              className="text-sm font-medium text-[#A69DC0] hover:text-plum transition-colors cursor-pointer"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedOutcome || isSaving}
              className="px-5 py-2 text-sm font-semibold text-white bg-plum rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save & Close"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
