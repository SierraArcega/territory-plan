import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";

export const dynamic = "force-dynamic";

// GET /api/reps — the active rep roster (role='rep') the dashboard ranks against,
// for the rep-scope dropdown. Names + avatars only; never emails/PII (the client
// passes back the opaque id as `?rep=`).
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reps = await getActiveReps();
  return NextResponse.json(
    reps.map((r) => ({ id: r.id, fullName: r.fullName, avatarUrl: r.avatarUrl })),
  );
}
