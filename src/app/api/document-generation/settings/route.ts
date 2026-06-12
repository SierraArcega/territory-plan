// GET /api/document-generation/settings — doc-gen client settings (any authed user).
// Currently: { testMode } so the form can annotate "Send for signature".
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getDropboxSignTestMode } from "@/features/shared/lib/app-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const testMode = await getDropboxSignTestMode();
    return NextResponse.json({ testMode });
  } catch (error) {
    console.error("Error fetching doc-gen settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}
