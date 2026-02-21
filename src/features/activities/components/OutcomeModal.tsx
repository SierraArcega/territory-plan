// OutcomeModal — Shown when an activity is completed (from table or calendar confirm).
// Section A: Category-specific outcome pills + optional note
// Section B: Optional follow-up activity and/or follow-up task creation
// Section C: Skip / Save actions

"use client";

import { useState } from "react";
import {
  useUpdateActivity,
  useCreateActivity,
  useCreateTask,
} from "@/lib/api";
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

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  const updateActivity = useUpdateActivity();
  const createActivity = useCreateActivity();
  const createTask = useCreateTask();

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

      onClose();
    } catch {
      // Let mutation error states surface in the UI
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] bg-white text-[#403770]";
  const labelStyle =
    "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Modal card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-[#403770]">What happened?</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Tag the outcome of &ldquo;{activity.title}&rdquo;
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Section A — Outcome Selection */}
            <div>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
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

              {/* Auto-task hint */}
              {selectedOutcome && OUTCOME_CONFIGS[selectedOutcome].autoTask && (
                <p className="mt-2 text-[11px] text-[#6EA3BE] flex items-center gap-1">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  This will auto-create a{" "}
                  {OUTCOME_CONFIGS[selectedOutcome].autoTask === "follow_up"
                    ? "follow-up task"
                    : "prep task"}
                </p>
              )}

              {/* Quick note */}
              {!showNote ? (
                <button
                  onClick={() => setShowNote(true)}
                  className="mt-2 text-xs text-gray-400 hover:text-[#403770] transition-colors"
                >
                  + Add a quick note
                </button>
              ) : (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="How did it go? (optional)"
                  rows={2}
                  autoFocus
                  className={`mt-2 ${inputStyle} resize-none`}
                />
              )}
            </div>

            {/* Section B — Follow-up Creation */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Follow-ups
              </p>

              {/* Follow-up Activity toggle */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFollowUpActivity(!showFollowUpActivity)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <span className="font-medium text-gray-700">Schedule follow-up activity</span>
                  </span>
                  <div
                    className={`w-8 h-[18px] rounded-full transition-colors relative ${
                      showFollowUpActivity ? "bg-[#403770]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
                        showFollowUpActivity ? "translate-x-[16px]" : "translate-x-[2px]"
                      }`}
                    />
                  </div>
                </button>

                {showFollowUpActivity && (
                  <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50/50">
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
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowFollowUpTask(!showFollowUpTask)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">✅</span>
                    <span className="font-medium text-gray-700">Create follow-up task</span>
                  </span>
                  <div
                    className={`w-8 h-[18px] rounded-full transition-colors relative ${
                      showFollowUpTask ? "bg-[#403770]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
                        showFollowUpTask ? "translate-x-[16px]" : "translate-x-[2px]"
                      }`}
                    />
                  </div>
                </button>

                {showFollowUpTask && (
                  <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50/50">
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
                          <option value="high">🔴 High</option>
                          <option value="medium">🟡 Medium</option>
                          <option value="low">🟢 Low</option>
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
            </div>
          </div>

          {/* Section C — Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedOutcome || isSaving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
