import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { fetchLeaderboardData } from "@/features/leaderboard/lib/fetch-leaderboard";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — Revenue Overview payload (cookie-authed)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await fetchLeaderboardData();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
