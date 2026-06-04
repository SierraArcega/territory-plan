"use client";

import UserAvatar from "@/features/shared/components/UserAvatar";

interface OwnerValue {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface Props {
  owner: OwnerValue | null;
}

/** Renders the district app owner (districts.owner_id) as avatar + name. */
export function DistrictOwnerCell({ owner }: Props) {
  if (!owner) return <span className="text-[#A69DC0]">—</span>;
  return (
    <span className="flex items-center gap-1.5 overflow-hidden">
      <UserAvatar name={owner.fullName} avatarUrl={owner.avatarUrl} size={20} />
      <span className="truncate whitespace-nowrap" title={owner.fullName ?? undefined}>
        {owner.fullName ?? "Unnamed user"}
      </span>
    </span>
  );
}
