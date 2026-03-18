"use client";

import { useUsers } from "@/features/shared/lib/queries";

interface AttendeeSelectProps {
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
}

export default function AttendeeSelect({ selectedUserIds, onChange }: AttendeeSelectProps) {
  const { data: users } = useUsers();

  const toggle = (userId: string) => {
    onChange(
      selectedUserIds.includes(userId)
        ? selectedUserIds.filter((id) => id !== userId)
        : [...selectedUserIds, userId]
    );
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Fullmind Attendees
      </label>
      <div className="border border-gray-300 rounded-lg max-h-32 overflow-y-auto">
        {users && users.length > 0 ? (
          users.map((user) => (
            <label
              key={user.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedUserIds.includes(user.id)}
                onChange={() => toggle(user.id)}
                className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]"
              />
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <span className="text-sm text-gray-700 truncate">
                {user.fullName || user.email}
              </span>
            </label>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-gray-500">Loading team members...</p>
        )}
      </div>
    </div>
  );
}
