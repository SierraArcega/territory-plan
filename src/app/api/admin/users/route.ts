import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/users — list all users with pagination, search, role filter
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") || "25", 10)));
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role");

    const where: Record<string, unknown> = {};

    if (role === "admin" || role === "user") {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.userProfile.findMany({
        where,
        orderBy: { lastLoginAt: { sort: "desc", nulls: "last" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          jobTitle: true,
          role: true,
          hasCompletedSetup: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.userProfile.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total },
    });
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

// POST /api/admin/users - Create a stub user profile (pre-provision before login)
export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
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
