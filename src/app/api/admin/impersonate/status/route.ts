import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getRealUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/impersonate/status — check if impersonation is active
export async function GET() {
  try {
    const realUser = await getRealUser();
    if (!realUser) {
      return NextResponse.json({ active: false });
    }

    const cookieStore = await cookies();
    const impersonateUid = cookieStore.get("impersonate_uid")?.value;

    if (!impersonateUid) {
      return NextResponse.json({ active: false });
    }

    // Verify the real user is admin
    const adminProfile = await prisma.userProfile.findUnique({
      where: { id: realUser.id },
      select: { role: true },
    });

    if (!adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json({ active: false });
    }

    // Get the impersonated user's info
    const targetUser = await prisma.userProfile.findUnique({
      where: { id: impersonateUid },
      select: { fullName: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ active: false });
    }

    return NextResponse.json({
      active: true,
      userName: targetUser.fullName,
      userEmail: targetUser.email,
    });
  } catch {
    return NextResponse.json({ active: false });
  }
}
