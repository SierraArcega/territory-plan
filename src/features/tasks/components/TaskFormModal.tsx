"use client";

import { useState, useEffect } from "react";
import {
  useCreateTask,
  useTerritoryPlans,
  useActivities,
  useDistricts,
  useContacts,
  type DistrictListItem,
  type ContactListItem,
} from "@/lib/api";
import {
  TASK_STATUSES,
  TASK_STATUS_CONFIG,
  TASK_PRIORITIES,
  TASK_PRIORITY_CONFIG,
  type TaskStatus,
  type TaskPriority,
} from "@/features/tasks/types";
import { ACTIVITY_TYPE_ICONS } from "@/features/activities/types";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlanId?: string;
  defaultActivityId?: string;
  defaultLeaid?: string;
  defaultContactId?: number;
}

export default function TaskFormModal({
  isOpen,
  onClose,
  defaultPlanId,
  defaultActivityId,
  defaultLeaid,
  defaultContactId,
}: TaskFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  // Linking state
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<
    { leaid: string; name: string }[]
  >([]);
  const [selectedContacts, setSelectedContacts] = useState<
    { id: number; name: string }[]
  >([]);

  // UI state
  const [openSection, setOpenSection] = useState<
    "plans" | "activities" | "districts" | "contacts" | null
  >(null);
  const [districtSearch, setDistrictSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  const createTask = useCreateTask();
  const { data: plans } = useTerritoryPlans({ enabled: isOpen });
  const { data: activitiesData } = useActivities();
  const { data: districtsData } = useDistricts({
    search: districtSearch || undefined,
    limit: 20,
  });
  const { data: contactsData } = useContacts({
    search: contactSearch || undefined,
    limit: 20,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setSelectedPlanIds(defaultPlanId ? [defaultPlanId] : []);
      setSelectedActivityIds(defaultActivityId ? [defaultActivityId] : []);
      setSelectedDistricts([]);
      setSelectedContacts([]);
      setOpenSection(null);
      setDistrictSearch("");
      setContactSearch("");
    }
  }, [isOpen, defaultPlanId, defaultActivityId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const leaids = selectedDistricts.map((d) => d.leaid);
    if (defaultLeaid && !leaids.includes(defaultLeaid)) {
      leaids.push(defaultLeaid);
    }

    const contactIds = selectedContacts.map((c) => c.id);
    if (defaultContactId && !contactIds.includes(defaultContactId)) {
      contactIds.push(defaultContactId);
    }

    await createTask.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      planIds: selectedPlanIds.length > 0 ? selectedPlanIds : undefined,
      activityIds:
        selectedActivityIds.length > 0 ? selectedActivityIds : undefined,
      leaids: leaids.length > 0 ? leaids : undefined,
      contactIds: contactIds.length > 0 ? contactIds : undefined,
    });

    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setDueDate("");
    setSelectedPlanIds([]);
    setSelectedActivityIds([]);
    setSelectedDistricts([]);
    setSelectedContacts([]);
    onClose();
  };

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    );
  };

  const toggleActivity = (activityId: string) => {
    setSelectedActivityIds((prev) =>
      prev.includes(activityId)
        ? prev.filter((id) => id !== activityId)
        : [...prev, activityId]
    );
  };

  const toggleDistrict = (district: DistrictListItem) => {
    setSelectedDistricts((prev) =>
      prev.some((d) => d.leaid === district.leaid)
        ? prev.filter((d) => d.leaid !== district.leaid)
        : [...prev, { leaid: district.leaid, name: district.name }]
    );
  };

  const toggleContact = (contact: ContactListItem) => {
    setSelectedContacts((prev) =>
      prev.some((c) => c.id === contact.id)
        ? prev.filter((c) => c.id !== contact.id)
        : [...prev, { id: contact.id, name: contact.name }]
    );
  };

  const toggleSection = (
    section: "plans" | "activities" | "districts" | "contacts"
  ) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const totalLinked =
    selectedPlanIds.length +
    selectedActivityIds.length +
    selectedDistricts.length +
    selectedContacts.length;

  const inputStyle =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]";
  const labelStyle =
    "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";

  const chevron = (section: string) => (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${openSection === section ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-[#403770]">New Task</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-4">
            {/* Title */}
            <div>
              <label className={labelStyle}>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className={inputStyle}
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className={labelStyle}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Add details..."
                className={`${inputStyle} resize-none`}
              />
            </div>

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelStyle}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className={inputStyle}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_CONFIG[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelStyle}>Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className={inputStyle}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {TASK_PRIORITY_CONFIG[p].icon} {TASK_PRIORITY_CONFIG[p].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className={labelStyle}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputStyle}
              />
            </div>

            {/* Link To section */}
            <div>
              <label className={labelStyle}>
                Link To
                {totalLinked > 0 && (
                  <span className="ml-1 text-[#F37167]">({totalLinked})</span>
                )}
              </label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                {/* Plans */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleSection("plans")}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-700">Plans</span>
                    <span className="flex items-center gap-2">
                      {selectedPlanIds.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-[#403770] text-white rounded-full">
                          {selectedPlanIds.length}
                        </span>
                      )}
                      {chevron("plans")}
                    </span>
                  </button>
                  {openSection === "plans" && (
                    <div className="border-t border-gray-100 max-h-32 overflow-y-auto">
                      {plans && plans.length > 0 ? (
                        plans.map((plan) => (
                          <label
                            key={plan.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPlanIds.includes(plan.id)}
                              onChange={() => togglePlan(plan.id)}
                              className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]"
                            />
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: plan.color }}
                            />
                            <span className="text-sm text-gray-700 truncate">
                              {plan.name}
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-gray-500">No plans yet</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Activities */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleSection("activities")}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-700">Activities</span>
                    <span className="flex items-center gap-2">
                      {selectedActivityIds.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-[#F37167] text-white rounded-full">
                          {selectedActivityIds.length}
                        </span>
                      )}
                      {chevron("activities")}
                    </span>
                  </button>
                  {openSection === "activities" && (
                    <div className="border-t border-gray-100 max-h-32 overflow-y-auto">
                      {activitiesData?.activities &&
                      activitiesData.activities.length > 0 ? (
                        activitiesData.activities.map((activity) => (
                          <label
                            key={activity.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedActivityIds.includes(activity.id)}
                              onChange={() => toggleActivity(activity.id)}
                              className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]"
                            />
                            <span className="text-sm flex-shrink-0">
                              {ACTIVITY_TYPE_ICONS[activity.type]}
                            </span>
                            <span className="text-sm text-gray-700 truncate">
                              {activity.title}
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-gray-500">No activities yet</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Districts */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleSection("districts")}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-700">Districts</span>
                    <span className="flex items-center gap-2">
                      {selectedDistricts.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-[#6EA3BE] text-white rounded-full">
                          {selectedDistricts.length}
                        </span>
                      )}
                      {chevron("districts")}
                    </span>
                  </button>
                  {openSection === "districts" && (
                    <div className="border-t border-gray-100">
                      {selectedDistricts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                          {selectedDistricts.map((d) => (
                            <span
                              key={d.leaid}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-[#EEF5F8] text-[#6EA3BE]"
                            >
                              {d.name}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDistricts((prev) =>
                                    prev.filter((x) => x.leaid !== d.leaid)
                                  );
                                }}
                                className="hover:opacity-75"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={districtSearch}
                          onChange={(e) => setDistrictSearch(e.target.value)}
                          placeholder="Search districts..."
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#6EA3BE]"
                        />
                      </div>
                      {districtSearch && (
                        <div className="max-h-32 overflow-y-auto border-t border-gray-100">
                          {districtsData?.districts &&
                          districtsData.districts.length > 0 ? (
                            districtsData.districts.map((d) => {
                              const isSelected = selectedDistricts.some(
                                (s) => s.leaid === d.leaid
                              );
                              return (
                                <button
                                  key={d.leaid}
                                  type="button"
                                  onClick={() => toggleDistrict(d)}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${
                                    isSelected ? "bg-blue-50" : ""
                                  }`}
                                >
                                  {isSelected && (
                                    <svg
                                      className="w-3.5 h-3.5 text-[#6EA3BE] flex-shrink-0"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                  <span className="truncate text-gray-700">{d.name}</span>
                                  <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">
                                    {d.stateAbbrev}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <p className="px-3 py-2 text-sm text-gray-500">No results</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Contacts */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleSection("contacts")}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-700">Contacts</span>
                    <span className="flex items-center gap-2">
                      {selectedContacts.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-[#8AA891] text-white rounded-full">
                          {selectedContacts.length}
                        </span>
                      )}
                      {chevron("contacts")}
                    </span>
                  </button>
                  {openSection === "contacts" && (
                    <div className="border-t border-gray-100">
                      {selectedContacts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                          {selectedContacts.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-[#EFF5F0] text-[#8AA891]"
                            >
                              {c.name}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedContacts((prev) =>
                                    prev.filter((x) => x.id !== c.id)
                                  );
                                }}
                                className="hover:opacity-75"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="px-3 py-2">
                        <input
                          type="text"
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts..."
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#8AA891]"
                        />
                      </div>
                      {contactSearch && (
                        <div className="max-h-32 overflow-y-auto border-t border-gray-100">
                          {contactsData?.contacts &&
                          contactsData.contacts.length > 0 ? (
                            contactsData.contacts.map((c) => {
                              const isSelected = selectedContacts.some(
                                (s) => s.id === c.id
                              );
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => toggleContact(c)}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${
                                    isSelected ? "bg-green-50" : ""
                                  }`}
                                >
                                  {isSelected && (
                                    <svg
                                      className="w-3.5 h-3.5 text-[#8AA891] flex-shrink-0"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate text-gray-700">{c.name}</span>
                                    {c.title && (
                                      <span className="text-xs text-gray-400 truncate">
                                        {c.title}
                                      </span>
                                    )}
                                  </div>
                                  {c.districtName && (
                                    <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">
                                      {c.districtName}
                                    </span>
                                  )}
                                </button>
                              );
                            })
                          ) : (
                            <p className="px-3 py-2 text-sm text-gray-500">No results</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTask.isPending || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 transition-colors"
            >
              {createTask.isPending ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
