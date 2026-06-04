"use client";

import { useState } from "react";

export function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

interface UserAvatarProps {
  name: string | null;
  avatarUrl: string | null;
  /** Diameter in px. Default 28. */
  size?: number;
  className?: string;
}

/**
 * Circular user avatar with an initials fallback. Tracks a broken image URL so a
 * failing avatar only attempts to load once. Renders as a <span> so it can be
 * embedded inside chips, buttons, and rows.
 */
export default function UserAvatar({ name, avatarUrl, size = 28, className = "" }: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const showImg = avatarUrl && !broken;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-plum/10 text-plum font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      title={name ?? undefined}
    >
      {showImg ? (
        <img
          src={avatarUrl}
          alt=""
          onError={() => setBroken(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
