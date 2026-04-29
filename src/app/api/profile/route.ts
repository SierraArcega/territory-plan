import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

// Helper to convert Decimal to number
function toNumber(val: Decimal | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return val.toNumber();
}

// GET /api/profile - Get or create user profile
export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // When impersonating, just read the profile — don't overwrite with admin's
    // Supabase metadata (email, name, avatar) which would corrupt the target
    // user's data and violate the unique email constraint.
    let profile;
    if (user.isImpersonating) {
      profile = await prisma.userProfile.findUnique({
        where: { id: user.id },
      });

      if (!profile) {
        return NextResponse.json(
          { error: "User profile not found" },
          { status: 404 }
        );
      }
    } else {
      // Upsert the profile - create if doesn't exist, update lastLoginAt if it does
      profile = await prisma.userProfile.upsert({
        where: { id: user.id },
        update: {
          // Update user info from Supabase on each login
          email: user.email!,
          fullName:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null,
          avatarUrl:
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            null,
          lastLoginAt: new Date(),
        },
        create: {
          id: user.id,
          email: user.email!,
          fullName:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null,
          avatarUrl:
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            null,
          hasCompletedSetup: false,
          lastLoginAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      jobTitle: profile.jobTitle,
      role: profile.role,
      location: profile.location,
      locationLat: toNumber(profile.locationLat) || null,
      locationLng: toNumber(profile.locationLng) || null,
      phone: profile.phone,
      slackUrl: profile.slackUrl,
      bio: profile.bio,
      bookingLink: profile.bookingLink,
      hasCompletedSetup: profile.hasCompletedSetup,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT /api/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fullName, hasCompletedSetup, jobTitle, location, locationLat, locationLng, phone, slackUrl, bio, bookingLink, avatarUrl } = body;

    // Build update data - only include fields that were provided
    const updateData: {
      fullName?: string | null;
      hasCompletedSetup?: boolean;
      jobTitle?: string | null;
      location?: string | null;
      locationLat?: number | null;
      locationLng?: number | null;
      phone?: string | null;
      slackUrl?: string | null;
      bio?: string | null;
      bookingLink?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (fullName !== undefined) {
      updateData.fullName = fullName?.trim() || null;
    }
    if (hasCompletedSetup !== undefined) {
      updateData.hasCompletedSetup = Boolean(hasCompletedSetup);
    }
    if (jobTitle !== undefined) {
      updateData.jobTitle = jobTitle?.trim() || null;
    }
    if (location !== undefined) {
      updateData.location = location?.trim() || null;
    }
    if (locationLat !== undefined) {
      updateData.locationLat = locationLat;
    }
    if (locationLng !== undefined) {
      updateData.locationLng = locationLng;
    }
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }
    if (slackUrl !== undefined) {
      updateData.slackUrl = slackUrl?.trim() || null;
    }
    if (bio !== undefined) {
      updateData.bio = bio?.trim() || null;
    }
    if (bookingLink !== undefined) {
      updateData.bookingLink = bookingLink?.trim() || null;
    }
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl?.trim() || null;
    }

    // Update the profile
    const profile = await prisma.userProfile.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      jobTitle: profile.jobTitle,
      role: profile.role,
      location: profile.location,
      locationLat: toNumber(profile.locationLat) || null,
      locationLng: toNumber(profile.locationLng) || null,
      phone: profile.phone,
      slackUrl: profile.slackUrl,
      bio: profile.bio,
      bookingLink: profile.bookingLink,
      hasCompletedSetup: profile.hasCompletedSetup,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      lastLoginAt: profile.lastLoginAt?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error updating profile:", message, error);
    return NextResponse.json(
      { error: `Failed to update profile: ${message}` },
      { status: 500 }
    );
  }
}
