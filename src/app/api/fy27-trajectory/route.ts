import { NextResponse } from "next/server";
import { fetchTrajectoryData } from "@/app/fy27-trajectory/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchTrajectoryData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching trajectory data:", error);
    return NextResponse.json(
      { error: "Failed to fetch trajectory data" },
      { status: 500 }
    );
  }
}
