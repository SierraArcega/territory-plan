"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useCreateActivity, useTerritoryPlans, useCreateTerritoryPlan, useStates, useCreateTask, useUpdateActivity } from "@/lib/api";
import { useDeleteActivity } from "@/features/activities/lib/queries";
import { useActivity } from "@/features/activities/lib/queries";
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
import DistrictSearchInput from "./event-fields/DistrictSearchInput";
import ActivityViewPanel from "./ActivityViewPanel";
import { type OutcomeType } from "@/features/activities/outcome-types";
import type { OpportunityResult } from "@/features/activities/lib/outcome-types-api";

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: ActivityCategory;
  defaultPlanId?: string;
  embedded?: boolean;
  editActivityId?: string;
}

type ModalStep = "pick-category" | "pick-type" | "form";

export default function ActivityFormModal({
  isOpen,
  onClose,
  defaultCategory,
  defaultPlanId,
  embedded,
  editActivityId,
}: ActivityFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivityMutation = useDeleteActivity();
  const createTask = useCreateTask();
  const createPlan = useCreateTerritoryPlan();
  const { data: plans } = useTerritoryPlans({ enabled: isOpen });
  const { data: states } = useStates({ enabled: isOpen });
  const { data: editActivity, isLoading: isLoadingEdit } = useActivity(isOpen && editActivityId ? editActivityId : null);
  const isEditMode = !!editActivityId;
  const isEditLoading = isEditMode && isLoadingEdit;

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
  const [selectedDistricts, setSelectedDistricts] = useState<
    { leaid: string; name: string; stateAbbrev: string | null; visitDate?: string; notes?: string }[]
  >([]);

  // Outcome state
  const [outcomeRating, setOutcomeRating] = useState(0);
  const [selectedOutcomes, setSelectedOutcomes] = useState<OutcomeType[]>([]);
  const [outcomeNote, setOutcomeNote] = useState("");

  // Outcome extras
  const [linkedOpportunities, setLinkedOpportunities] = useState<OpportunityResult[]>([]);
  const [outcomeContacts, setOutcomeContacts] = useState<SelectedContact[]>([]);

  // Tab state (lifted so submit can access)
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [expenses, setExpenses] = useState<{ description: string; amount: number }[]>([]);
  const [relatedActivities, setRelatedActivities] = useState<RelationDraft[]>([]);

  // Navigation stack for viewing related activities
  const [viewStack, setViewStack] = useState<{ id: string; title: string }[]>([]);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [successFlash, setSuccessFlash] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    setOutcomeRating(0);
    setSelectedOutcomes([]);
    setOutcomeNote("");
    setLinkedOpportunities([]);
    setOutcomeContacts([]);
    setSelectedDistricts([]);
    setTaskDrafts([]);
    setExpenses([]);
    setRelatedActivities([]);
    setViewStack([]);
    setError(null);
    setShowNewPlanForm(false);
    setNewPlanName("");
    setShowDeleteConfirm(false);
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        setStep("form");
      } else {
        resetForm();
      }
      setSuccessFlash(null);
    }
  }, [isOpen, defaultCategory, defaultPlanId, isEditMode]);

  // Populate form when edit activity data loads
  useEffect(() => {
    if (!editActivity || !isEditMode) return;
    const cat = getCategoryForType(editActivity.type as ActivityType);
    setSelectedCategory(cat);
    setType(editActivity.type as ActivityType);
    setTitle(editActivity.title);
    setStartDate(editActivity.startDate ? editActivity.startDate.split("T")[0] : "");
    setEndDate(editActivity.endDate ? editActivity.endDate.split("T")[0] : "");
    setIsMultiDay(!!editActivity.endDate);
    setNotes(editActivity.notes || "");
    setStatus(editActivity.status);
    setSelectedPlanIds(editActivity.plans?.map((p) => p.planId) || []);
    setSelectedStateFips(editActivity.states?.map((s) => s.fips) || []);
    setMetadata((editActivity.metadata as Record<string, unknown>) || {});
    setAttendeeUserIds(editActivity.attendees?.map((a) => a.userId) || []);
    setSelectedDistricts(
      editActivity.districts?.map((d) => ({
        leaid: d.leaid,
        name: d.name || d.leaid,
        stateAbbrev: d.stateAbbrev || null,
        visitDate: d.visitDate ? d.visitDate.split("T")[0] : "",
        notes: d.notes || "",
      })) || []
    );
    setExpenses(
      editActivity.expenses?.map((e) => ({ description: e.description, amount: Number(e.amount) })) || []
    );
    setRelatedActivities(
      editActivity.relatedActivities?.map((r) => ({
        activityId: r.activityId,
        title: r.title,
        type: r.type,
        startDate: r.startDate,
        status: r.status,
        relationType: r.relationType,
      })) || []
    );
    setStep("form");
  }, [editActivity, isEditMode]);

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

  const handleDelete = async () => {
    if (!editActivityId) return;
    try {
      await deleteActivityMutation.mutateAsync(editActivityId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete activity");
      setShowDeleteConfirm(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, { createAnother = false } = {}) => {
    e.preventDefault();
    if (!title.trim()) return;

    const isEvent = getCategoryForType(type) === "events";
    const hasMetadata = isEvent && Object.keys(metadata).length > 0;

    // Address now lives on real columns. The type-specific sub-fields still
    // collect it into the metadata bag for backwards compat — pull it out
    // here and forward as top-level fields so the new columns stay in sync.
    const meta = metadata as Record<string, unknown>;
    const extractedAddress =
      typeof meta.address === "string" && meta.address.trim()
        ? meta.address.trim()
        : null;
    const extractedLat =
      typeof meta.addressLat === "number" ? meta.addressLat : null;
    const extractedLng =
      typeof meta.addressLng === "number" ? meta.addressLng : null;

    setError(null);
    try {
      if (isEditMode && editActivityId) {
        await updateActivity.mutateAsync({
          activityId: editActivityId,
          type,
          title: title.trim(),
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: isMultiDay && endDate ? new Date(endDate).toISOString() : null,
          notes: notes.trim() || null,
          status,
          outcomeType: selectedOutcomes.length > 0 ? selectedOutcomes[0] : null,
          outcome: outcomeNote.trim() || null,
          rating: outcomeRating > 0 ? outcomeRating : undefined,
          address: extractedAddress,
          addressLat: extractedLat,
          addressLng: extractedLng,
          metadata: hasMetadata ? metadata : null,
          attendeeUserIds: attendeeUserIds.length > 0 ? attendeeUserIds : [],
          expenses: expenses.filter((e) => e.description.trim()),
          districts: selectedDistricts.map((d, index) => ({
            leaid: d.leaid,
            position: index,
            visitDate: d.visitDate || null,
            notes: d.notes || null,
          })),
        });
        onClose();
        return;
      }

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
        address: extractedAddress ?? undefined,
        addressLat: extractedLat ?? undefined,
        addressLng: extractedLng ?? undefined,
        metadata: hasMetadata ? metadata : undefined,
        attendeeUserIds: attendeeUserIds.length > 0 ? attendeeUserIds : undefined,
        contactIds: (() => {
          const allIds = [...new Set([...selectedContacts.map((c) => c.id), ...outcomeContacts.map((c) => c.id)])];
          return allIds.length > 0 ? allIds : undefined;
        })(),
        expenses: expenses.length > 0 ? expenses.filter((e) => e.description.trim()) : undefined,
        districts: (() => {
          const explicitLeaids = new Set(selectedDistricts.map((d) => d.leaid));
          const contactDistricts = selectedContacts
            .filter((c) => !explicitLeaids.has(c.leaid))
            .map((c, i) => ({ leaid: c.leaid, position: selectedDistricts.length + i }));
          const explicit = selectedDistricts.map((d, i) => ({
            leaid: d.leaid,
            position: i,
            visitDate: d.visitDate || undefined,
            notes: d.notes || undefined,
          }));
          const all = [...explicit, ...contactDistricts];
          return all.length > 0 ? all : undefined;
        })(),
        relatedActivityIds: relatedActivities.length > 0
          ? relatedActivities.map((r) => ({ activityId: r.activityId, relationType: r.relationType }))
          : undefined,
        outcome: outcomeNote.trim() || undefined,
        outcomeType: selectedOutcomes.length > 0 ? selectedOutcomes[0] : undefined,
        rating: outcomeRating > 0 ? outcomeRating : undefined,
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

      // Link opportunities (via update, since POST doesn't support it)
      if (linkedOpportunities.length > 0 && activity?.id) {
        await updateActivity.mutateAsync({
          activityId: activity.id,
          opportunityIds: linkedOpportunities.map((o) => o.id),
        });
      }

      if (createAnother) {
        resetForm();
        setSuccessFlash(`"${savedTitle}" created`);
        setTimeout(() => setSuccessFlash(null), 2500);
      } else {
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${isEditMode ? "update" : "create"} activity`;
      setError(message);
      console.error(`Failed to ${isEditMode ? "update" : "create"} activity:`, err);
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

  if (!isOpen) return null;

  // Picker steps use a narrower modal
  const isPickerStep = step === "pick-category" || step === "pick-type";

  const content = (
      <div
        ref={modalRef}
        className={embedded
          ? "flex flex-col h-full overflow-hidden"
          : `bg-white rounded-2xl shadow-xl w-full max-h-[85vh] overflow-hidden flex flex-col transition-all ${
              isPickerStep ? "max-w-xl" : "max-w-5xl"
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
                  {isEditMode ? "Edit" : "New"} {ACTIVITY_TYPE_LABELS[type]}
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
                    <span>{isEditMode ? "Edit" : "New"} {ACTIVITY_TYPE_LABELS[type]}</span>
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

        {/* Loading state for edit mode */}
        {step === "form" && isEditLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="w-8 h-8 border-3 border-[#403770] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#8A80A8]">Loading activity...</p>
            </div>
          </div>
        )}

        {/* Step 3: Two-panel form */}
        {step === "form" && !isViewing && !isEditLoading && (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-1 overflow-hidden">
              {/* ── Left Panel: Event Info ── */}
              <div className="w-[55%] overflow-y-auto p-6 space-y-4">
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

                {/* Date + Status */}
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
                  {/* Auto-linked districts & states as chips */}
                  {selectedContacts.length > 0 && (() => {
                    const explicitLeaids = new Set(selectedDistricts.map((d) => d.leaid));
                    const autoDistricts = [...new Map(
                      selectedContacts
                        .filter((c) => !explicitLeaids.has(c.leaid) && c.districtName)
                        .map((c) => [c.leaid, c.districtName] as const)
                    ).entries()];
                    const stateAbbrevMap = new Map((states ?? []).map((s) => [s.fips, s.abbrev]));
                    const explicitFips = new Set(selectedStateFips);
                    const autoStates = [...new Set(
                      selectedContacts.map((c) => c.leaid.slice(0, 2)).filter((fips) => !explicitFips.has(fips))
                    )].map((fips) => ({ fips, abbrev: stateAbbrevMap.get(fips) })).filter((s) => s.abbrev);
                    if (autoDistricts.length === 0 && autoStates.length === 0) return null;
                    return (
                      <div className="mt-2 space-y-2">
                        {autoDistricts.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-[#8A80A8] mb-1">Districts</label>
                            <div className="flex flex-wrap gap-1.5">
                              {autoDistricts.map(([leaid, name]) => (
                                <span key={leaid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e8f1f5] text-[#3B6B83] rounded-md text-[11px]">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {autoStates.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-[#8A80A8] mb-1">States</label>
                            <div className="flex flex-wrap gap-1.5">
                              {autoStates.map((s) => (
                                <span key={s.fips} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EFEDF5] text-[#544A78] rounded-md text-[11px]">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {s.abbrev}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Districts — compact chips for non-road-trip types; road trips use the stops UI in Details */}
                {type !== "road_trip" && (
                  <div>
                    <label className="block text-xs font-medium text-[#8A80A8] mb-1">Districts</label>
                    {selectedDistricts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedDistricts.map((d) => (
                          <span
                            key={d.leaid}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EFEDF5] text-[#544A78] rounded-md text-[11px]"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {d.name}
                            {d.stateAbbrev && <span className="text-[#8A80A8]">· {d.stateAbbrev}</span>}
                            <button
                              type="button"
                              onClick={() => setSelectedDistricts((prev) => prev.filter((x) => x.leaid !== d.leaid))}
                              className="ml-0.5 text-[#A69DC0] hover:text-[#F37167] transition-colors"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <DistrictSearchInput
                      excludeLeaids={selectedDistricts.map((d) => d.leaid)}
                      onSelect={(d) => setSelectedDistricts((prev) => [...prev, { leaid: d.leaid, name: d.name, stateAbbrev: d.stateAbbrev }])}
                    />
                  </div>
                )}

                {/* Fullmind Attendees — team members on this activity */}
                {isEventCategory && (
                  <div>
                    <label className="block text-xs font-medium text-[#8A80A8] mb-1">Fullmind Attendees</label>
                    <AttendeeSelect selectedUserIds={attendeeUserIds} onChange={setAttendeeUserIds} />
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-[#E2DEEC]" />

                {/* Type-specific details */}
                {isEventCategory && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">Details</p>
                    <EventTypeFields
                      type={type}
                      metadata={metadata}
                      onMetadataChange={setMetadata}
                      districtStops={type === "road_trip" ? selectedDistricts : undefined}
                      onDistrictStopsChange={type === "road_trip" ? setSelectedDistricts : undefined}
                    />
                  </div>
                )}

                {/* Organization & Notes */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">Organization</p>
                  <div>
                    <label className="block text-xs font-medium text-[#8A80A8] mb-1">Plans</label>
                    <MultiSelect
                      id="activity-plans"
                      label="Plans"
                      options={planOptions}
                      selected={selectedPlanIds}
                      onChange={setSelectedPlanIds}
                      placeholder="Select..."
                      countLabel="plans"
                      searchPlaceholder="Search plans..."
                      footer={
                        showNewPlanForm ? (
                          <div className="flex items-center gap-1.5 p-2">
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
                              className="flex-1 px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F37167] text-[#403770] placeholder:text-[#A69DC0]"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleCreateAndLinkPlan}
                              disabled={!newPlanName.trim() || createPlan.isPending}
                              className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 transition-colors duration-100"
                            >
                              {createPlan.isPending ? "..." : "Add"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowNewPlanForm(true)}
                            className="flex items-center gap-1.5 w-full px-3 py-2.5 text-xs font-medium text-[#403770] hover:bg-[#F7F5FA] transition-colors duration-100"
                          >
                            <svg className="w-3.5 h-3.5 text-[#F37167]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create New Plan
                          </button>
                        )
                      }
                    />
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
              <div className="w-[45%] border-l border-[#E2DEEC] flex flex-col">
                <ActivityFormTabs
                  taskDrafts={taskDrafts}
                  onTaskDraftsChange={setTaskDrafts}
                  expenses={expenses}
                  onExpensesChange={setExpenses}
                  relatedActivities={relatedActivities}
                  onRelatedActivitiesChange={setRelatedActivities}
                  onViewActivity={handleViewActivity}
                  outcomeRating={outcomeRating}
                  onOutcomeRatingChange={setOutcomeRating}
                  selectedOutcomes={selectedOutcomes}
                  onSelectedOutcomesChange={setSelectedOutcomes}
                  outcomeNote={outcomeNote}
                  onOutcomeNoteChange={setOutcomeNote}
                  activityCategory={selectedCategory}
                  linkedOpportunities={linkedOpportunities}
                  onLinkedOpportunitiesChange={setLinkedOpportunities}
                  outcomeContacts={outcomeContacts}
                  onOutcomeContactsChange={setOutcomeContacts}
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
            <div className="flex items-center gap-3 px-6 py-4 border-t border-[#E2DEEC]">
              {isEditMode && (
                showDeleteConfirm ? (
                  <div className="flex items-center gap-2 mr-auto">
                    <span className="text-sm text-[#6E6390]">Delete this activity?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteActivityMutation.isPending}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleteActivityMutation.isPending ? "Deleting..." : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="mr-auto px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                )
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {!isEditMode && (
                  <button
                    type="button"
                    disabled={!title.trim() || createActivity.isPending}
                    onClick={(e) => handleSubmit(e as unknown as React.FormEvent, { createAnother: true })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#403770] border border-[#C2BBD4] rounded-lg hover:bg-[#EFEDF5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Save & Create New
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!title.trim() || createActivity.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createActivity.isPending && (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  {isEditMode
                    ? (updateActivity.isPending ? "Saving..." : "Save Changes")
                    : (createActivity.isPending ? "Creating..." : "Create Activity")}
                </button>
              </div>
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
