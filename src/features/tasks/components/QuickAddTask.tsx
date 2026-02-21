"use client";

import { useState, useRef, useEffect } from "react";
import { useCreateTask } from "@/lib/api";
import type { TaskStatus } from "@/lib/taskTypes";

// Inline text input for quickly creating tasks — used at the bottom of kanban columns
// and in embedded task lists. Pass preLinks to auto-link to a plan, activity, district, etc.
interface QuickAddTaskProps {
  status?: TaskStatus;
  planId?: string;
  activityId?: string;
  leaid?: string;
  contactId?: number;
  onCreated?: () => void;
  placeholder?: string;
}

export default function QuickAddTask({
  status = "todo",
  planId,
  activityId,
  leaid,
  contactId,
  onCreated,
  placeholder = "Add a task...",
}: QuickAddTaskProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();

  // Auto-focus the input when entering add mode
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setIsAdding(false);
      return;
    }

    try {
      await createTask.mutateAsync({
        title: title.trim(),
        status,
        planIds: planId ? [planId] : undefined,
        activityIds: activityId ? [activityId] : undefined,
        leaids: leaid ? [leaid] : undefined,
        contactIds: contactId ? [contactId] : undefined,
      });
      setTitle("");
      onCreated?.();
      // Stay in add mode so user can add another task quickly
    } catch {
      // Error is handled by React Query
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setTitle("");
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-[#403770] hover:bg-gray-50 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {placeholder}
      </button>
    );
  }

  return (
    <div className="px-1">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder="Task title — Enter to save, Esc to cancel"
        disabled={createTask.isPending}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] placeholder:text-gray-400"
      />
    </div>
  );
}
