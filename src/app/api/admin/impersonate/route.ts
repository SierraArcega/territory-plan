import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getRealUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/admin/impersonate — start or stop impersonation
export async function POST(request: Request) {
  try {
    const realUser = await getRealUser();
    if (!realUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify admin role
    const profile = await prisma.userProfile.findUnique({
      where: { id: realUser.id },
      select: { role: true },
    });

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body as { userId: string | null };

    const cookieStore = await cookies();

    // Stop impersonation
    if (!userId) {
      cookieStore.delete("impersonate_uid");
      return NextResponse.json({ ok: true });
    }

    // Start impersonation — verify target user exists
    const targetUser = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Don't allow impersonating yourself
    if (userId === realUser.id) {
      return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 });
    }

    cookieStore.set("impersonate_uid", userId, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 3600, // 1 hour auto-expiry
    });

    return NextResponse.json({ ok: true, user: targetUser });
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Failed to process impersonation" }, { status: 500 });
  }
}
