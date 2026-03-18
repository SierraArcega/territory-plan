"use client";

import { useMemo } from "react";
import { useUsers } from "@/features/shared/lib/queries";
import { MultiSelect } from "@/features/shared/components/MultiSelect";

interface AttendeeSelectProps {
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
}

export default function AttendeeSelect({ selectedUserIds, onChange }: AttendeeSelectProps) {
  const { data: users } = useUsers();

  const options = useMemo(
    () =>
      (users ?? []).map((user) => ({
        value: user.id,
        label: user.fullName || user.email,
      })),
    [users]
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Fullmind Attendees
      </label>
      <MultiSelect
        id="activity-attendees"
        label="Fullmind Attendees"
        options={options}
        selected={selectedUserIds}
        onChange={onChange}
        placeholder="Select attendees..."
        countLabel="attendees"
        searchPlaceholder="Search team members..."
      />
    </div>
  );
}
