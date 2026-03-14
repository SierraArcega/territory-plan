import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH /api/admin/users/[id] — update user role, name, job title, or deactivated status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { role, fullName, jobTitle } = body as {
      role?: string;
      fullName?: string;
      jobTitle?: string;
    };

    // Validate the user exists
    const existing = await prisma.userProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build update data
    const data: Record<string, unknown> = {};

    if (role !== undefined) {
      if (role !== "admin" && role !== "user") {
        return NextResponse.json({ error: "Invalid role. Must be 'admin' or 'user'" }, { status: 400 });
      }
      // Prevent removing your own admin role
      if (id === admin.profile.id && role !== "admin") {
        return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
      }
      data.role = role;
    }

    if (fullName !== undefined) {
      data.fullName = fullName?.trim() || null;
    }

    if (jobTitle !== undefined) {
      data.jobTitle = jobTitle?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.userProfile.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        jobTitle: true,
        role: true,
        hasCompletedSetup: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
