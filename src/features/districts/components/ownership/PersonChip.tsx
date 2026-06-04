"use client";

import UserAvatar from "@/features/shared/components/UserAvatar";

interface PersonChipProps {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  onRemove: () => void;
  disabled?: boolean;
}

/** Removable avatar + name chip used for collaborators and watchers. */
export default function PersonChip({ name, email, avatarUrl, onRemove, disabled }: PersonChipProps) {
  const label = name || email;
  return (
    <span className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-[#F7F5FA] border border-[#EFEDF5]">
      <UserAvatar name={name} avatarUrl={avatarUrl} size={20} />
      <span className="text-xs text-[#403770] truncate whitespace-nowrap max-w-[140px]">{label}</span>
      <button
        onClick={onRemove}
        disabled={disabled}
        className="text-[#A69DC0] hover:text-[#403770] disabled:opacity-50"
        aria-label={`Remove ${label}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
