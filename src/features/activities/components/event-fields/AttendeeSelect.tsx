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
    <MultiSelect
      id="activity-attendees"
      label="Attendees"
      options={options}
      selected={selectedUserIds}
      onChange={onChange}
      placeholder="Select..."
      countLabel="attendees"
      searchPlaceholder="Search team members..."
    />
  );
}
