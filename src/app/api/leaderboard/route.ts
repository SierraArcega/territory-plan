import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { fetchLeaderboardData, NoActiveInitiativeError } from "@/features/leaderboard/lib/fetch-leaderboard";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — full leaderboard for active initiative (cookie-authed)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = await fetchLeaderboardData();
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof NoActiveInitiativeError) {
      return NextResponse.json({ error: "No active initiative" }, { status: 404 });
    }
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
