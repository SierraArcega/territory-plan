"use client";

import { useState, useEffect } from "react";
import {
  useTask,
  useUpdateTask,
  useDeleteTask,
  useUnlinkTaskPlan,
  useUnlinkTaskDistrict,
  useUnlinkTaskActivity,
  useUnlinkTaskContact,
  useLinkTaskPlans,
  useLinkTaskDistricts,
  useLinkTaskActivities,
  useLinkTaskContacts,
  useTerritoryPlans,
  useActivities,
  useDistricts,
  useContacts,
  type TaskItem,
} from "@/lib/api";
import {
  TASK_STATUSES,
  TASK_STATUS_CONFIG,
  TASK_PRIORITIES,
  TASK_PRIORITY_CONFIG,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/taskTypes";
import { ACTIVITY_TYPE_ICONS } from "@/lib/activityTypes";

interface TaskDetailModalProps {
  task: TaskItem;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  // Fetch fresh task data so link mutations are reflected immediately
  const { data: freshTask } = useTask(task.id);
  const currentTask = freshTask ?? task;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState<TaskStatus>(task.status as TaskStatus);
  const [priority, setPriority] = useState<TaskPriority>(task.priority as TaskPriority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Link picker state
  const [linkingEntity, setLinkingEntity] = useState<
    "plans" | "activities" | "districts" | "contacts" | null
  >(null);
  const [districtSearch, setDistrictSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const unlinkPlan = useUnlinkTaskPlan();
  const unlinkDistrict = useUnlinkTaskDistrict();
  const unlinkActivity = useUnlinkTaskActivity();
  const unlinkContact = useUnlinkTaskContact();

  // Link mutations
  const linkPlans = useLinkTaskPlans();
  const linkDistricts = useLinkTaskDistricts();
  const linkActivities = useLinkTaskActivities();
  const linkContacts = useLinkTaskContacts();

  // Data hooks for pickers
  const { data: plans } = useTerritoryPlans();
  const { data: activitiesData } = useActivities();
  const { data: districtsData } = useDistricts({
    search: districtSearch || undefined,
    limit: 20,
  });
  const { data: contactsData } = useContacts({
    search: contactSearch || undefined,
    limit: 20,
  });

  // Reset form when task changes (use prop task for form fields)
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status as TaskStatus);
    setPriority(task.priority as TaskPriority);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setConfirmDelete(false);
    setLinkingEntity(null);
    setDistrictSearch("");
    setContactSearch("");
  }, [task]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await updateTask.mutateAsync({
      taskId: task.id,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    });
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteTask.mutateAsync(task.id);
    onClose();
  };

  const handleLinkPlan = (planId: string) => {
    linkPlans.mutate({ taskId: task.id, planIds: [planId] });
  };

  const handleLinkActivity = (activityId: string) => {
    linkActivities.mutate({ taskId: task.id, activityIds: [activityId] });
  };

  const handleLinkDistrict = (leaid: string) => {
    linkDistricts.mutate({ taskId: task.id, leaids: [leaid] });
  };

  const handleLinkContact = (contactId: number) => {
    linkContacts.mutate({ taskId: task.id, contactIds: [contactId] });
  };

  const toggleLinkPicker = (
    entity: "plans" | "activities" | "districts" | "contacts"
  ) => {
    setLinkingEntity((prev) => (prev === entity ? null : entity));
    setDistrictSearch("");
    setContactSearch("");
  };

  // Use currentTask (fresh from server) for linked entities
  const linkedPlanIds = new Set(currentTask.plans.map((p) => p.planId));
  const availablePlans = plans?.filter((p) => !linkedPlanIds.has(p.id)) ?? [];

  const linkedActivityIds = new Set(currentTask.activities.map((a) => a.activityId));
  const availableActivities =
    activitiesData?.activities?.filter((a) => !linkedActivityIds.has(a.id)) ?? [];

  const linkedLeaids = new Set(currentTask.districts.map((d) => d.leaid));
  const linkedContactIds = new Set(currentTask.contacts.map((c) => c.contactId));

  const inputStyle =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]";
  const labelStyle =
    "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";
  const linkBtnBase =
    "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-[#403770]">Edit Task</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable form content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className={labelStyle}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputStyle}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputStyle} resize-none`}
              placeholder="Add details..."
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelStyle}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={inputStyle}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>
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
                  <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].icon} {TASK_PRIORITY_CONFIG[p].label}</option>
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

          {/* Linked entities — always rendered */}
          <div>
            <label className={labelStyle}>Linked To</label>

            {/* Existing linked entity pills */}
            {(currentTask.plans.length > 0 ||
              currentTask.districts.length > 0 ||
              currentTask.activities.length > 0 ||
              currentTask.contacts.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {currentTask.plans.map((p) => (
                  <span
                    key={p.planId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full text-white"
                    style={{ backgroundColor: p.planColor }}
                  >
                    {p.planName}
                    <button
                      onClick={() =>
                        unlinkPlan.mutate({ taskId: task.id, planId: p.planId })
                      }
                      className="ml-0.5 hover:opacity-75"
                    >
                      x
                    </button>
                  </span>
                ))}
                {currentTask.districts.map((d) => (
                  <span
                    key={d.leaid}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-[#EEF5F8] text-[#6EA3BE]"
                  >
                    {d.name}
                    <button
                      onClick={() =>
                        unlinkDistrict.mutate({ taskId: task.id, leaid: d.leaid })
                      }
                      className="ml-0.5 hover:opacity-75"
                    >
                      x
                    </button>
                  </span>
                ))}
                {currentTask.activities.map((a) => (
                  <span
                    key={a.activityId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-[#FEF2F1] text-[#F37167]"
                  >
                    {a.title}
                    <button
                      onClick={() =>
                        unlinkActivity.mutate({
                          taskId: task.id,
                          activityId: a.activityId,
                        })
                      }
                      className="ml-0.5 hover:opacity-75"
                    >
                      x
                    </button>
                  </span>
                ))}
                {currentTask.contacts.map((c) => (
                  <span
                    key={c.contactId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-[#EFF5F0] text-[#8AA891]"
                  >
                    {c.name}
                    <button
                      onClick={() =>
                        unlinkContact.mutate({
                          taskId: task.id,
                          contactId: c.contactId,
                        })
                      }
                      className="ml-0.5 hover:opacity-75"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Link buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleLinkPicker("plans")}
                className={`${linkBtnBase} ${
                  linkingEntity === "plans"
                    ? "bg-[#403770] text-white border-[#403770]"
                    : "text-[#403770] border-[#403770]/30 hover:bg-[#403770]/5"
                }`}
              >
                + Plan
              </button>
              <button
                type="button"
                onClick={() => toggleLinkPicker("activities")}
                className={`${linkBtnBase} ${
                  linkingEntity === "activities"
                    ? "bg-[#F37167] text-white border-[#F37167]"
                    : "text-[#F37167] border-[#F37167]/30 hover:bg-[#F37167]/5"
                }`}
              >
                + Activity
              </button>
              <button
                type="button"
                onClick={() => toggleLinkPicker("districts")}
                className={`${linkBtnBase} ${
                  linkingEntity === "districts"
                    ? "bg-[#6EA3BE] text-white border-[#6EA3BE]"
                    : "text-[#6EA3BE] border-[#6EA3BE]/30 hover:bg-[#6EA3BE]/5"
                }`}
              >
                + District
              </button>
              <button
                type="button"
                onClick={() => toggleLinkPicker("contacts")}
                className={`${linkBtnBase} ${
                  linkingEntity === "contacts"
                    ? "bg-[#8AA891] text-white border-[#8AA891]"
                    : "text-[#8AA891] border-[#8AA891]/30 hover:bg-[#8AA891]/5"
                }`}
              >
                + Contact
              </button>
            </div>

            {/* Inline picker: Plans */}
            {linkingEntity === "plans" && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-36 overflow-y-auto">
                {availablePlans.length > 0 ? (
                  availablePlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => handleLinkPlan(plan.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: plan.color }}
                      />
                      <span className="text-gray-700 truncate">{plan.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    {plans ? "All plans already linked" : "Loading..."}
                  </p>
                )}
              </div>
            )}

            {/* Inline picker: Activities */}
            {linkingEntity === "activities" && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-36 overflow-y-auto">
                {availableActivities.length > 0 ? (
                  availableActivities.map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => handleLinkActivity(activity.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex-shrink-0">
                        {ACTIVITY_TYPE_ICONS[activity.type]}
                      </span>
                      <span className="text-gray-700 truncate">{activity.title}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    {activitiesData ? "All activities already linked" : "Loading..."}
                  </p>
                )}
              </div>
            )}

            {/* Inline picker: Districts */}
            {linkingEntity === "districts" && (
              <div className="mt-2 border border-gray-200 rounded-lg">
                <div className="px-3 py-2">
                  <input
                    type="text"
                    value={districtSearch}
                    onChange={(e) => setDistrictSearch(e.target.value)}
                    placeholder="Search districts..."
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#6EA3BE]"
                    autoFocus
                  />
                </div>
                {districtSearch && (
                  <div className="max-h-32 overflow-y-auto border-t border-gray-100">
                    {districtsData?.districts &&
                    districtsData.districts.length > 0 ? (
                      districtsData.districts.map((d) => {
                        const alreadyLinked = linkedLeaids.has(d.leaid);
                        return (
                          <button
                            key={d.leaid}
                            type="button"
                            onClick={() =>
                              !alreadyLinked && handleLinkDistrict(d.leaid)
                            }
                            disabled={alreadyLinked}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left ${
                              alreadyLinked
                                ? "text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <span className="truncate">{d.name}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">
                              {alreadyLinked ? "linked" : d.stateAbbrev}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-3 py-2 text-sm text-gray-500">
                        No results
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Inline picker: Contacts */}
            {linkingEntity === "contacts" && (
              <div className="mt-2 border border-gray-200 rounded-lg">
                <div className="px-3 py-2">
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#8AA891]"
                    autoFocus
                  />
                </div>
                {contactSearch && (
                  <div className="max-h-32 overflow-y-auto border-t border-gray-100">
                    {contactsData?.contacts &&
                    contactsData.contacts.length > 0 ? (
                      contactsData.contacts.map((c) => {
                        const alreadyLinked = linkedContactIds.has(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              !alreadyLinked && handleLinkContact(c.id)
                            }
                            disabled={alreadyLinked}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left ${
                              alreadyLinked
                                ? "text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{c.name}</span>
                              {c.title && (
                                <span className="text-xs text-gray-400 truncate">
                                  {c.title}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">
                              {alreadyLinked ? "linked" : c.districtName ?? ""}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-3 py-2 text-sm text-gray-500">
                        No results
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            onClick={handleDelete}
            disabled={deleteTask.isPending}
            className={`text-sm font-medium ${
              confirmDelete
                ? "text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg"
                : "text-red-500 hover:text-red-700"
            } transition-colors`}
          >
            {deleteTask.isPending
              ? "Deleting..."
              : confirmDelete
                ? "Confirm Delete"
                : "Delete"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateTask.isPending || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 transition-colors"
            >
              {updateTask.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
