import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/auth/logout - Sign out the current user
export async function POST() {
  try {
    const supabase = await createClient();

    // Sign out the user - this clears the session
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      return NextResponse.json(
        { error: "Failed to sign out" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error during logout:", error);
    return NextResponse.json(
      { error: "Failed to sign out" },
      { status: 500 }
    );
  }
}
