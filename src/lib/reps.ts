import prisma from "@/lib/prisma";

export interface ActiveRep {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

// The roster the dashboard ranks against: reps only (`role = 'rep'`), excluding
// managers and admins. Product decision (2026-05-28): rank vs all active reps,
// reps-only. Single source for both the ranking roster and the "N reps" count.
export async function getActiveReps(): Promise<ActiveRep[]> {
  return prisma.userProfile.findMany({
    where: { role: "rep" },
    select: { id: true, email: true, fullName: true, avatarUrl: true },
    orderBy: { fullName: "asc" },
  });
}
