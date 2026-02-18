import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/admin/users - Create a stub user profile (pre-provision before login)
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { email, fullName } = body as { email?: string; fullName?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if a profile already exists with this email
    const existing = await prisma.userProfile.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user profile with this email already exists" },
        { status: 409 },
      );
    }

    const profile = await prisma.userProfile.create({
      data: {
        id: randomUUID(),
        email: normalizedEmail,
        fullName: fullName?.trim() || null,
        hasCompletedSetup: false,
        // lastLoginAt left null — identifies this as a stub
      },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Error creating stub user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
