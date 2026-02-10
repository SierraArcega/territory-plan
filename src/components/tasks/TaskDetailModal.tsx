"use client";

import { useState, useEffect } from "react";
import {
  useUpdateTask,
  useDeleteTask,
  useUnlinkTaskPlan,
  useUnlinkTaskDistrict,
  useUnlinkTaskActivity,
  useUnlinkTaskContact,
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

// Full task editor modal — title, description, status, priority, due date,
// linked entities (with remove), and delete button
interface TaskDetailModalProps {
  task: TaskItem;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState<TaskStatus>(task.status as TaskStatus);
  const [priority, setPriority] = useState<TaskPriority>(task.priority as TaskPriority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const unlinkPlan = useUnlinkTaskPlan();
  const unlinkDistrict = useUnlinkTaskDistrict();
  const unlinkActivity = useUnlinkTaskActivity();
  const unlinkContact = useUnlinkTaskContact();

  // Reset form when task changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status as TaskStatus);
    setPriority(task.priority as TaskPriority);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setConfirmDelete(false);
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

  const inputStyle =
    "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]";
  const labelStyle = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
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

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
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

          {/* Linked entities */}
          {(task.plans.length > 0 || task.districts.length > 0 || task.activities.length > 0 || task.contacts.length > 0) && (
            <div>
              <label className={labelStyle}>Linked To</label>
              <div className="flex flex-wrap gap-2">
                {/* Plans */}
                {task.plans.map((p) => (
                  <span
                    key={p.planId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full text-white"
                    style={{ backgroundColor: p.planColor }}
                  >
                    {p.planName}
                    <button
                      onClick={() => unlinkPlan.mutate({ taskId: task.id, planId: p.planId })}
                      className="ml-0.5 hover:opacity-75"
                    >
                      x
                    </button>
                  </span>
                ))}

                {/* Districts */}
                {task.districts.map((d) => (
                  <span
                    key={d.leaid}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-[#EEF5F8] text-[#6EA3BE]"
                  >
                    {d.name}
                    <button
                      onClick={() => unlinkDistrict.mutate({ taskId: task.id, leaid: d.leaid })}
                      className="ml-0.5 hover:opacity-75"
                    >
                      x
                    </button>
                  </span>
                ))}

                {/* Activities */}
                {task.activities.map((a) => (
                  <span
                    key={a.activityId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-[#FEF2F1] text-[#F37167]"
                  >
                    {a.title}
                    <button
                      onClick={() => unlinkActivity.mutate({ taskId: task.id, activityId: a.activityId })}
                      className="ml-0.5 hover:opacity-75"
                    >
                      x
                    </button>
                  </span>
                ))}

                {/* Contacts */}
                {task.contacts.map((c) => (
                  <span
                    key={c.contactId}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-[#EFF5F0] text-[#8AA891]"
                  >
                    {c.name}
                    <button
                      onClick={() => unlinkContact.mutate({ taskId: task.id, contactId: c.contactId })}
                      className="ml-0.5 hover:opacity-75"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={deleteTask.isPending}
            className={`text-sm font-medium ${
              confirmDelete
                ? "text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg"
                : "text-red-500 hover:text-red-700"
            } transition-colors`}
          >
            {deleteTask.isPending ? "Deleting..." : confirmDelete ? "Confirm Delete" : "Delete"}
          </button>

          {/* Save/Cancel */}
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
