const AVATAR_PALETTE = ["#403770", "#6EA3BE", "#F37167", "#8AA891", "#544A78"] as const;

export function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function ownerColor(name: string | null): string {
  let h = 0;
  for (const c of name ?? "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
