"use client";

import { useState } from "react";
import { useCreateTask } from "@/lib/api";
import {
  TASK_STATUSES,
  TASK_STATUS_CONFIG,
  TASK_PRIORITIES,
  TASK_PRIORITY_CONFIG,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/taskTypes";

// Full create-task form modal with all fields
// Used when clicking "New Task" button (vs QuickAddTask which is title-only)
interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Optional pre-linked context
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
  const createTask = useCreateTask();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createTask.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      planIds: defaultPlanId ? [defaultPlanId] : undefined,
      activityIds: defaultActivityId ? [defaultActivityId] : undefined,
      leaids: defaultLeaid ? [defaultLeaid] : undefined,
      contactIds: defaultContactId ? [defaultContactId] : undefined,
    });

    // Reset form and close
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setDueDate("");
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
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
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

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
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
