"use client";

import { useState, useEffect, useCallback } from "react";
import { useUpdateCalendarSyncConfig } from "@/features/calendar/lib/queries";

const REMINDER_OPTIONS = [
  { value: 0, label: "None" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 1440, label: "1 day" },
] as const;

interface RemindersCardProps {
  reminderMinutes: number;
  secondReminderMinutes: number | null;
}

export default function RemindersCard({
  reminderMinutes,
  secondReminderMinutes,
}: RemindersCardProps) {
  const [primary, setPrimary] = useState(reminderMinutes);
  const [secondary, setSecondary] = useState<number | null>(secondReminderMinutes);
  const [showSaved, setShowSaved] = useState(false);
  const mutation = useUpdateCalendarSyncConfig();

  useEffect(() => {
    setPrimary(reminderMinutes);
    setSecondary(secondReminderMinutes);
  }, [reminderMinutes, secondReminderMinutes]);

  const save = useCallback(
    (updates: { reminderMinutes?: number; secondReminderMinutes?: number | null }) => {
      mutation.mutate(updates, {
        onSuccess: () => {
          setShowSaved(true);
          setTimeout(() => setShowSaved(false), 1500);
        },
      });
    },
    [mutation]
  );

  const handlePrimaryChange = useCallback(
    (value: number) => {
      setPrimary(value);
      // If secondary is the same as new primary, clear it
      const newSecondary = secondary === value ? null : secondary;
      if (newSecondary !== secondary) setSecondary(newSecondary);
      save({ reminderMinutes: value, ...(newSecondary !== secondary ? { secondReminderMinutes: newSecondary } : {}) });
    },
    [secondary, save]
  );

  const handleSecondaryChange = useCallback(
    (value: number | null) => {
      setSecondary(value);
      save({ secondReminderMinutes: value });
    },
    [save]
  );

  // Filter secondary options to exclude the primary selection (and include None)
  const secondaryOptions = REMINDER_OPTIONS.filter(
    (opt) => opt.value === 0 || opt.value !== primary
  );

  return (
    <div className="bg-white rounded-xl border border-[#D4CFE2] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#403770]">Reminders</h3>
        {showSaved && (
          <span className="text-xs text-[#69B34A] font-medium animate-fade-in">
            Saved
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Primary reminder */}
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Primary reminder
          </label>
          <select
            value={primary}
            onChange={(e) => handlePrimaryChange(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] transition-colors appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238A80A8' viewBox='0 0 16 16'%3E%3Cpath d='M4.646 6.646a.5.5 0 0 1 .708 0L8 9.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.75rem center",
              paddingRight: "2rem",
            }}
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Secondary reminder */}
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Second reminder
          </label>
          <select
            value={secondary ?? 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              handleSecondaryChange(val === 0 ? null : val);
            }}
            className="w-full px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770] transition-colors appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238A80A8' viewBox='0 0 16 16'%3E%3Cpath d='M4.646 6.646a.5.5 0 0 1 .708 0L8 9.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.75rem center",
              paddingRight: "2rem",
            }}
          >
            {secondaryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 0 ? "None" : opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mutation.isError && (
        <p className="text-xs text-[#F37167] mt-3">
          Failed to save. <button onClick={() => save({ reminderMinutes: primary, secondReminderMinutes: secondary })} className="underline">Retry</button>
        </p>
      )}
    </div>
  );
}
