"use client";

import { useId } from "react";

// Off-by-default opt-in: when checked, linked contacts receive a Google
// Calendar invite (sendUpdates: "all"); otherwise they are attendees on the
// event but not emailed. Transient — the parent does not persist this value.
interface SendInviteToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
}

export default function SendInviteToggle({ checked, onChange }: SendInviteToggleProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  return (
    <div className="flex items-start gap-2.5 select-none">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={helperId}
        className="mt-0.5 h-4 w-4 rounded border-[#C2BBD4] text-[#F37167] focus:ring-[#F37167] cursor-pointer"
      />
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[#403770] whitespace-nowrap cursor-pointer"
        >
          Send calendar invite to contacts
        </label>
        <span id={helperId} className="block text-xs text-[#8A80A8]">
          {checked
            ? "Contacts will get a Google Calendar invite."
            : "Contacts are added to the calendar event but not emailed."}
        </span>
      </div>
    </div>
  );
}
