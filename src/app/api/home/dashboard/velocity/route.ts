import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { getCurrentFY, schoolYearForFY } from "@/lib/fiscal-year";
import { buildVelocity, type RepVelocityAgg } from "@/features/home/lib/velocity";
import { fetchVelocity } from "@/features/home/lib/velocity-source";

export const dynamic = "force-dynamic";

// GET /api/home/dashboard/velocity?fy=2026
// The Velocity card: four ranked metrics (close rate, avg deal size, gross margin,
// deals won) for the calling rep, with prior-FY deltas + team median. One batched
// all-reps fetch; ranks/medians computed in JS.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fyParam = searchParams.get("fy");
  const fy = fyParam == null ? getCurrentFY() : Number(fyParam);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    return NextResponse.json({ error: "fy must be a fiscal-year number like 2026" }, { status: 400 });
  }

  const schoolYr = schoolYearForFY(fy);
  const priorSchoolYr = schoolYearForFY(fy - 1);
  const reps = await getActiveReps();
  const callerEmail = reps.find((r) => r.id === user.id)?.email ?? null;

  const { current, priorCaller } = await fetchVelocity(schoolYr, priorSchoolYr, callerEmail);
  const currentByEmail = new Map<string, RepVelocityAgg>(
    current.map((r) => [r.email, { wonCount: r.wonCount, closedCount: r.closedCount, wonBookingSum: r.wonBookingSum, takeSum: r.takeSum, revSum: r.revSum }]),
  );
  const priorCallerAgg: RepVelocityAgg | null = priorCaller
    ? { wonCount: priorCaller.wonCount, closedCount: priorCaller.closedCount, wonBookingSum: priorCaller.wonBookingSum, takeSum: priorCaller.takeSum, revSum: priorCaller.revSum }
    : null;

  const cells = buildVelocity(reps, currentByEmail, priorCallerAgg, user.id);
  return NextResponse.json({ fy, schoolYr, cells });
}
