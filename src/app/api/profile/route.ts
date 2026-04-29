import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { getFinancialValue, FULLMIND_FINANCIALS_SELECT } from "@/features/shared/lib/financial-helpers";

export const dynamic = "force-dynamic";

// Helper to convert Decimal to number
function toNumber(val: Decimal | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return val.toNumber();
}

// Calculate actual progress from user's territory plan districts
// Aggregates revenue, take, pipeline, and new district counts by fiscal year
async function calculateActuals(userId: string) {
  // Get all districts in the user's territory plans with financial data
  const userDistricts = await prisma.territoryPlanDistrict.findMany({
    where: {
      plan: { userId },
    },
    include: {
      district: {
        select: {
          isCustomer: true,
          districtFinancials: {
            where: { vendor: "fullmind" },
            select: FULLMIND_FINANCIALS_SELECT,
          },
        },
      },
    },
  });

  // Aggregate actuals from districtFinancials
  const totals = userDistricts.reduce(
    (acc, d) => {
      const fin = d.district.districtFinancials;
      acc.fy25Revenue += getFinancialValue(fin, "fullmind", "FY25", "invoicing");
      acc.fy25Take += getFinancialValue(fin, "fullmind", "FY25", "totalTake");
      acc.fy26Revenue += getFinancialValue(fin, "fullmind", "FY26", "invoicing");
      acc.fy26Take += getFinancialValue(fin, "fullmind", "FY26", "totalTake");
      acc.fy26Pipeline += getFinancialValue(fin, "fullmind", "FY26", "openPipeline");
      acc.fy27Pipeline += getFinancialValue(fin, "fullmind", "FY27", "openPipeline");
      return acc;
    },
    { fy25Revenue: 0, fy25Take: 0, fy26Revenue: 0, fy26Take: 0, fy26Pipeline: 0, fy27Pipeline: 0 }
  );

  // New districts = non-customers in plan (potential new business)
  const fy26NewDistricts = userDistricts.filter(
    (d) => !d.district.isCustomer
  ).length;

  return {
    2025: {
      revenueActual: totals.fy25Revenue,
      takeActual: totals.fy25Take,
      pipelineActual: 0, // No FY25 pipeline data
      newDistrictsActual: 0, // Historical, not tracked
    },
    2026: {
      revenueActual: totals.fy26Revenue,
      takeActual: totals.fy26Take,
      pipelineActual: totals.fy26Pipeline,
      newDistrictsActual: fy26NewDistricts,
    },
    2027: {
      revenueActual: 0, // Future year
      takeActual: 0,
      pipelineActual: totals.fy27Pipeline,
      newDistrictsActual: 0,
    },
  };
}

// GET /api/profile - Get or create user profile with goals and progress
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
        include: {
          goals: {
            orderBy: { fiscalYear: "desc" },
          },
        },
      });

      if (!profile) {
        return NextResponse.json(
          { error: "User profile not found" },
          { status: 404 }
        );
      }
    } else {
      // Don't re-sync email/fullName/avatarUrl on update: email can collide with another row's @unique value, and the other two are user-edited in the form.
      try {
        profile = await prisma.userProfile.upsert({
          where: { id: user.id },
          update: {
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
          include: {
            goals: {
              orderBy: { fiscalYear: "desc" },
            },
          },
        });
      } catch (err) {
        // Recover from auth.users.id <-> user_profiles.id drift: if the create
        // path 500s on the email @unique, an existing row already holds this
        // user's email under a stale id. Look it up by email so the user is
        // unblocked, and log loudly so ops can run the rekey SQL.
        const isEmailCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          Array.isArray(err.meta?.target) &&
          (err.meta?.target as string[]).includes("email");

        if (!isEmailCollision) throw err;

        const byEmail = await prisma.userProfile.findUnique({
          where: { email: user.email! },
          include: {
            goals: {
              orderBy: { fiscalYear: "desc" },
            },
          },
        });

        if (!byEmail) throw err;

        console.warn(
          `[profile-id-drift] auth.users.id ${user.id} (${user.email}) has no matching user_profiles row. ` +
          `Falling back to user_profiles.id ${byEmail.id} via email match. Run the rekey SQL to repoint this row.`
        );

        profile = byEmail;
      }
    }

    // Calculate actuals from user's territory plans
    const actuals = await calculateActuals(user.id);

    // Format response with goals including calculated actuals
    const goalsWithActuals = profile.goals.map((goal) => {
      const yearActuals = actuals[goal.fiscalYear as keyof typeof actuals] || {
        revenueActual: 0,
        takeActual: 0,
        pipelineActual: 0,
        newDistrictsActual: 0,
      };

      return {
        id: goal.id,
        fiscalYear: goal.fiscalYear,
        earningsTarget: toNumber(goal.earningsTarget),
        takeRatePercent: toNumber(goal.takeRatePercent),
        renewalTarget: toNumber(goal.renewalTarget),
        winbackTarget: toNumber(goal.winbackTarget),
        expansionTarget: toNumber(goal.expansionTarget),
        newBusinessTarget: toNumber(goal.newBusinessTarget),
        newDistrictsTarget: goal.newDistrictsTarget,
        ...yearActuals,
      };
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
      goals: goalsWithActuals,
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
      include: {
        goals: {
          orderBy: { fiscalYear: "desc" },
        },
      },
    });

    // Calculate actuals from user's territory plans
    const actuals = await calculateActuals(user.id);

    // Format response
    const goalsWithActuals = profile.goals.map((goal) => {
      const yearActuals = actuals[goal.fiscalYear as keyof typeof actuals] || {
        revenueActual: 0,
        takeActual: 0,
        pipelineActual: 0,
        newDistrictsActual: 0,
      };

      return {
        id: goal.id,
        fiscalYear: goal.fiscalYear,
        earningsTarget: toNumber(goal.earningsTarget),
        takeRatePercent: toNumber(goal.takeRatePercent),
        renewalTarget: toNumber(goal.renewalTarget),
        winbackTarget: toNumber(goal.winbackTarget),
        expansionTarget: toNumber(goal.expansionTarget),
        newBusinessTarget: toNumber(goal.newBusinessTarget),
        newDistrictsTarget: goal.newDistrictsTarget,
        ...yearActuals,
      };
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
      goals: goalsWithActuals,
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
