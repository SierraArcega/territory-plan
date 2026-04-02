"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useCreateActivity, useTerritoryPlans, useCreateTerritoryPlan, useStates, useCreateTask } from "@/lib/api";
import {
  type ActivityCategory,
  type ActivityType,
  type ActivityStatus,
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CATEGORY_DESCRIPTIONS,
  DEFAULT_TYPE_FOR_CATEGORY,
  ACTIVITY_STATUS_CONFIG,
  getCategoryForType,
  getStatusesForType,
} from "@/features/activities/types";
import EventTypeFields from "./event-fields/EventTypeFields";
import { MultiSelect } from "@/features/shared/components/MultiSelect";
import CalendarPicker from "./event-fields/CalendarPicker";
import { type TaskDraft } from "./event-fields/TaskLineItems";
import AttendeeSelect from "./event-fields/AttendeeSelect";
import ActivityFormTabs from "./ActivityFormTabs";
import StatusSelect from "./event-fields/StatusSelect";
import { type RelationDraft } from "./tabs/RelatedActivitiesTab";
import ContactSelect, { type SelectedContact } from "./event-fields/ContactSelect";
import ActivityViewPanel from "./ActivityViewPanel";

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: ActivityCategory;
  defaultPlanId?: string;
  embedded?: boolean;
}

type ModalStep = "pick-category" | "pick-type" | "form";

export default function ActivityFormModal({
  isOpen,
  onClose,
  defaultCategory,
  defaultPlanId,
  embedded,
}: ActivityFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const createActivity = useCreateActivity();
  const createTask = useCreateTask();
  const createPlan = useCreateTerritoryPlan();
  const { data: plans } = useTerritoryPlans({ enabled: isOpen });
  const { data: states } = useStates({ enabled: isOpen });

  // Step management
  const [step, setStep] = useState<ModalStep>("pick-category");
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | null>(null);

  // Form state
  const [type, setType] = useState<ActivityType>("conference");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ActivityStatus>("planned");
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>(defaultPlanId ? [defaultPlanId] : []);
  const [selectedStateFips, setSelectedStateFips] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Type-specific state
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<SelectedContact[]>([]);
  const [districtStops, setDistrictStops] = useState<
    { leaid: string; name: string; stateAbbrev: string | null; visitDate: string; notes: string }[]
  >([]);

  // Tab state (lifted so submit can access)
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [expenses, setExpenses] = useState<{ description: string; amount: number }[]>([]);
  const [relatedActivities, setRelatedActivities] = useState<RelationDraft[]>([]);

  // Navigation stack for viewing related activities
  const [viewStack, setViewStack] = useState<{ id: string; title: string }[]>([]);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [successFlash, setSuccessFlash] = useState<string | null>(null);

  const resetForm = () => {
    if (defaultCategory) {
      setSelectedCategory(defaultCategory);
      const types = ACTIVITY_CATEGORIES[defaultCategory];
      if (types.length === 1) {
        setType(types[0] as ActivityType);
        setStep("form");
      } else {
        setStep("pick-type");
      }
    } else {
      setStep("pick-category");
      setSelectedCategory(null);
    }
    setType("conference");
    setTitle("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setIsMultiDay(false);
    setNotes("");
    setStatus("planned");
    setSelectedPlanIds(defaultPlanId ? [defaultPlanId] : []);
    setSelectedStateFips([]);
    setMetadata({});
    setAttendeeUserIds([]);
    setSelectedContacts([]);
    setDistrictStops([]);
    setTaskDrafts([]);
    setExpenses([]);
    setRelatedActivities([]);
    setViewStack([]);
    setError(null);
    setShowNewPlanForm(false);
    setNewPlanName("");
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm();
      setSuccessFlash(null);
    }
  }, [isOpen, defaultCategory, defaultPlanId]);

  useEffect(() => {
    if (embedded) return; // parent modal handles escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose, embedded]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleCategorySelect = (category: ActivityCategory) => {
    setSelectedCategory(category);
    const types = ACTIVITY_CATEGORIES[category];
    if (types.length === 1) {
      setType(types[0] as ActivityType);
      setStep("form");
    } else {
      setStep("pick-type");
    }
  };

  const handleTypeSelect = (activityType: ActivityType) => {
    setType(activityType);
    setStatus(getStatusesForType(activityType)[0]);
    setStep("form");
  };

  const handleBack = () => {
    if (step === "form" && selectedCategory) {
      const types = ACTIVITY_CATEGORIES[selectedCategory];
      if (types.length === 1) {
        setStep("pick-category");
        setSelectedCategory(null);
      } else {
        setStep("pick-type");
      }
    } else if (step === "pick-type") {
      setStep("pick-category");
      setSelectedCategory(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent, { createAnother = false } = {}) => {
    e.preventDefault();
    if (!title.trim()) return;

    const isEvent = getCategoryForType(type) === "events";
    const hasMetadata = isEvent && Object.keys(metadata).length > 0;

    setError(null);
    try {
      const savedTitle = title.trim();
      const activity = await createActivity.mutateAsync({
        type,
        title: savedTitle,
        startDate: startDate || undefined,
        endDate: isMultiDay && endDate ? endDate : undefined,
        notes: notes.trim() || undefined,
        status,
        planIds: selectedPlanIds.length > 0 ? selectedPlanIds : undefined,
        stateFips: selectedStateFips.length > 0 ? selectedStateFips : undefined,
        metadata: hasMetadata ? metadata : undefined,
        attendeeUserIds: attendeeUserIds.length > 0 ? attendeeUserIds : undefined,
        contactIds: selectedContacts.length > 0 ? selectedContacts.map((c) => c.id) : undefined,
        expenses: expenses.length > 0 ? expenses.filter((e) => e.description.trim()) : undefined,
        districts: (() => {
          // Merge district stops with auto-linked districts from contacts
          const stopLeaids = new Set(districtStops.map((s) => s.leaid));
          const contactDistricts = selectedContacts
            .filter((c) => !stopLeaids.has(c.leaid))
            .map((c, i) => ({ leaid: c.leaid, position: districtStops.length + i }));
          const stops = districtStops.map((s, i) => ({
            leaid: s.leaid,
            visitDate: s.visitDate || undefined,
            position: i,
            notes: s.notes || undefined,
          }));
          const all = [...stops, ...contactDistricts];
          return all.length > 0 ? all : undefined;
        })(),
        relatedActivityIds: relatedActivities.length > 0
          ? relatedActivities.map((r) => ({ activityId: r.activityId, relationType: r.relationType }))
          : undefined,
      });

      // Create linked tasks
      const validTasks = taskDrafts.filter((t) => t.title.trim());
      if (validTasks.length > 0 && activity?.id) {
        await Promise.all(
          validTasks.map((t) =>
            createTask.mutateAsync({
              title: t.title.trim(),
              priority: t.priority,
              dueDate: t.dueDate || undefined,
              activityIds: [activity.id],
              planIds: selectedPlanIds.length > 0 ? selectedPlanIds : undefined,
            })
          )
        );
      }

      if (createAnother) {
        resetForm();
        setSuccessFlash(`"${savedTitle}" created`);
        setTimeout(() => setSuccessFlash(null), 2500);
      } else {
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create activity";
      setError(message);
      console.error("Failed to create activity:", err);
    }
  };

  const handleViewActivity = (activityId: string, activityTitle: string) => {
    setViewStack((prev) => [...prev, { id: activityId, title: activityTitle }]);
  };

  const handleBreadcrumbNav = (index: number) => {
    // index -1 = back to create form, 0+ = specific view in stack
    setViewStack((prev) => prev.slice(0, index + 1));
  };

  const isViewing = viewStack.length > 0;
  const currentView = isViewing ? viewStack[viewStack.length - 1] : null;

  const handleCreateAndLinkPlan = async () => {
    if (!newPlanName.trim()) return;
    const currentYear = new Date().getFullYear();
    const newPlan = await createPlan.mutateAsync({
      name: newPlanName.trim(),
      fiscalYear: currentYear,
    });
    setSelectedPlanIds((prev) => [...prev, newPlan.id]);
    setNewPlanName("");
    setShowNewPlanForm(false);
  };

  const planOptions = useMemo(() => (plans ?? []).map((p) => ({ value: p.id, label: p.name })), [plans]);
  const stateOptions = useMemo(() => (states ?? []).map((s) => ({ value: s.fips, label: `${s.name} (${s.abbrev})` })), [states]);
  const typeCategory = getCategoryForType(type);
  const isEventCategory = typeCategory === "events" || typeCategory === "thought_leadership";
  const showExpenses = isEventCategory && (type === "conference" || type === "road_trip");

  if (!isOpen) return null;

  // Picker steps use a narrower modal
  const isPickerStep = step === "pick-category" || step === "pick-type";

  const content = (
      <div
        ref={modalRef}
        className={embedded
          ? "flex flex-col h-full overflow-hidden"
          : `bg-white rounded-2xl shadow-xl w-full max-h-[85vh] overflow-hidden flex flex-col transition-all ${
              isPickerStep ? "max-w-xl" : "max-w-4xl"
            }`
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
          <div className="flex items-center gap-3 min-w-0">
            {(step !== "pick-category" || isViewing) && (
              <button
                onClick={() => {
                  if (isViewing) {
                    setViewStack((prev) => prev.slice(0, -1));
                  } else {
                    handleBack();
                  }
                }}
                className="p-1 text-[#A69DC0] hover:text-[#403770] rounded-lg hover:bg-[#EFEDF5] transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Breadcrumbs when viewing related activities */}
            {isViewing ? (
              <div className="flex items-center gap-1.5 min-w-0 text-sm">
                <button
                  type="button"
                  onClick={() => handleBreadcrumbNav(-1)}
                  className="text-[#8A80A8] hover:text-[#403770] truncate max-w-[150px] transition-colors"
                >
                  New {ACTIVITY_TYPE_LABELS[type]}
                </button>
                {viewStack.map((item, i) => (
                  <span key={item.id} className="flex items-center gap-1.5 min-w-0">
                    <svg className="w-3 h-3 text-[#C2BBD4] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {i === viewStack.length - 1 ? (
                      <span className="font-semibold text-[#403770] truncate max-w-[200px]">{item.title}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBreadcrumbNav(i)}
                        className="text-[#8A80A8] hover:text-[#403770] truncate max-w-[150px] transition-colors"
                      >
                        {item.title}
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <h2 className="text-lg font-semibold text-[#403770]">
                {step === "pick-category" && "New Activity"}
                {step === "pick-type" && selectedCategory && CATEGORY_LABELS[selectedCategory]}
                {step === "form" && (
                  <span className="flex items-center gap-2">
                    <span>{ACTIVITY_TYPE_ICONS[type]}</span>
                    <span>New {ACTIVITY_TYPE_LABELS[type]}</span>
                  </span>
                )}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A69DC0] hover:text-[#403770] rounded-lg hover:bg-[#EFEDF5] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1: Category Picker */}
        {step === "pick-category" && (
          <div className="px-6 py-5">
            <p className="text-sm text-[#8A80A8] mb-4">What kind of activity are you creating?</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategorySelect(category)}
                  className="group flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-[#D4CFE2] hover:border-[#403770] hover:bg-[#F7F5FA] transition-all text-center"
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform">{CATEGORY_ICONS[category]}</span>
                  <span className="text-sm font-semibold text-[#403770]">{CATEGORY_LABELS[category]}</span>
                  <span className="text-xs text-[#A69DC0] leading-tight">{CATEGORY_DESCRIPTIONS[category]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Type Picker */}
        {step === "pick-type" && selectedCategory && (
          <div className="px-6 py-5">
            <p className="text-sm text-[#8A80A8] mb-4">What type of {CATEGORY_LABELS[selectedCategory].toLowerCase()}?</p>
            <div className="grid grid-cols-2 gap-3">
              {(ACTIVITY_CATEGORIES[selectedCategory] as readonly ActivityType[]).map((activityType) => (
                <button
                  key={activityType}
                  onClick={() => handleTypeSelect(activityType)}
                  className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-[#D4CFE2] hover:border-[#403770] hover:bg-[#F7F5FA] transition-all text-center"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{ACTIVITY_TYPE_ICONS[activityType]}</span>
                  <span className="text-sm font-medium text-[#403770]">{ACTIVITY_TYPE_LABELS[activityType]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* View mode — viewing a related activity */}
        {isViewing && currentView && (
          <ActivityViewPanel
            activityId={currentView.id}
            onViewRelated={handleViewActivity}
          />
        )}

        {/* Step 3: Two-panel form */}
        {step === "form" && !isViewing && (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
              {/* ── Left Panel: Event Info ── */}
              <div className="w-1/2 overflow-y-auto p-5 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-[#8A80A8] mb-1">
                    Title <span className="text-[#F37167]">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., SC Education Conference"
                    className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>

                {/* Date + Status side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <CalendarPicker
                    startDate={startDate}
                    endDate={endDate}
                    isMultiDay={isMultiDay}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onMultiDayChange={setIsMultiDay}
                  />
                  <StatusSelect
                    status={status}
                    onChange={setStatus}
                    statuses={getStatusesForType(type)}
                  />
                </div>

                {/* Contacts */}
                <div>
                  <ContactSelect
                    selectedContacts={selectedContacts}
                    onChange={setSelectedContacts}
                  />
                  {/* Auto-linked districts indicator */}
                  {selectedContacts.length > 0 && (() => {
                    const stopLeaids = new Set(districtStops.map((s) => s.leaid));
                    const autoLinked = [...new Map(
                      selectedContacts
                        .filter((c) => !stopLeaids.has(c.leaid) && c.districtName)
                        .map((c) => [c.leaid, c.districtName] as const)
                    ).entries()];
                    if (autoLinked.length === 0) return null;
                    return (
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <svg className="w-3.5 h-3.5 text-[#6EA3BE] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <p className="text-[11px] text-[#8A80A8] leading-tight">
                          {autoLinked.length === 1
                            ? <>{autoLinked[0][1]} will be linked</>
                            : <>{autoLinked.map(([, name]) => name).join(", ")} will be linked</>
                          }
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Type-specific details */}
                {isEventCategory && (
                  <div className="space-y-4">
                    <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">Details</p>
                    <EventTypeFields
                      type={type}
                      metadata={metadata}
                      onMetadataChange={setMetadata}
                      districtStops={districtStops}
                      onDistrictStopsChange={setDistrictStops}
                    />
                  </div>
                )}

                {/* People & Organization */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">People & Organization</p>
                  {isEventCategory && (
                    <div>
                      <label className="block text-xs font-medium text-[#8A80A8] mb-1">Attendees</label>
                      <AttendeeSelect selectedUserIds={attendeeUserIds} onChange={setAttendeeUserIds} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-[#8A80A8] mb-1">Plans</label>
                      <MultiSelect id="activity-plans" label="Plans" options={planOptions} selected={selectedPlanIds} onChange={setSelectedPlanIds} placeholder="Select..." countLabel="plans" searchPlaceholder="Search plans..." />
                      {showNewPlanForm ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="text"
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleCreateAndLinkPlan();
                              }
                              if (e.key === "Escape") {
                                setShowNewPlanForm(false);
                                setNewPlanName("");
                              }
                            }}
                            placeholder="Plan name..."
                            className="flex-1 px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#403770] text-[#403770]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleCreateAndLinkPlan}
                            disabled={!newPlanName.trim() || createPlan.isPending}
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 transition-colors"
                          >
                            {createPlan.isPending ? "..." : "Add"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowNewPlanForm(true)}
                          className="mt-1 text-xs font-medium text-[#403770] hover:text-[#322a5a] transition-colors"
                        >
                          + Create New Plan
                        </button>
                      )}
                      {selectedPlanIds.length === 0 && !showNewPlanForm && <p className="mt-1 text-xs text-[#F37167]">No plan linked</p>}
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-[#8A80A8] mb-1">States</label>
                      <MultiSelect id="activity-states" label="States" options={stateOptions} selected={selectedStateFips} onChange={setSelectedStateFips} placeholder="Select..." countLabel="states" searchPlaceholder="Search states..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8A80A8] mb-1">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes or details..."
                      rows={2}
                      className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* ── Right Panel: Tabs ── */}
              <div className="w-1/2 border-l border-[#E2DEEC] flex flex-col">
                <ActivityFormTabs
                  taskDrafts={taskDrafts}
                  onTaskDraftsChange={setTaskDrafts}
                  expenses={expenses}
                  onExpensesChange={setExpenses}
                  relatedActivities={relatedActivities}
                  onRelatedActivitiesChange={setRelatedActivities}
                  showExpenses={showExpenses}
                  onViewActivity={handleViewActivity}
                />
              </div>
            </div>

            {/* Success flash */}
            {successFlash && (
              <div className="mx-5 mb-2 p-3 bg-[#f0faf4] border border-[#6ec992] rounded-lg text-sm text-[#2d7a4f] flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {successFlash}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mx-5 mb-2 p-3 bg-[#fef1f0] border border-[#f58d85] rounded-lg text-sm text-[#F37167]">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2DEEC]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!title.trim() || createActivity.isPending}
                onClick={(e) => handleSubmit(e as unknown as React.FormEvent, { createAnother: true })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#403770] border border-[#C2BBD4] rounded-lg hover:bg-[#EFEDF5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save & Create New
              </button>
              <button
                type="submit"
                disabled={!title.trim() || createActivity.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createActivity.isPending && (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {createActivity.isPending ? "Creating..." : "Create Activity"}
              </button>
            </div>
          </form>
        )}
      </div>
  );

  if (embedded) return content;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      {content}
    </div>
  );
}
