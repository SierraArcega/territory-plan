import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "closed", "expired"] as const;
const VALID_CATEGORIES = [
  "SPED",
  "ELL",
  "General Ed",
  "Admin",
  "Specialist",
  "Counseling",
  "Related Services",
  "Other",
] as const;

// GET /api/vacancies/[id] - Get a single vacancy with related district and school data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const vacancy = await prisma.vacancy.findUnique({
      where: { id },
      include: {
        district: {
          select: {
            leaid: true,
            name: true,
            stateAbbrev: true,
            cityLocation: true,
          },
        },
        school: {
          select: {
            ncessch: true,
            schoolName: true,
            lograde: true,
            higrade: true,
          },
        },
      },
    });

    if (!vacancy) {
      return NextResponse.json(
        { error: "Vacancy not found" },
        { status: 404 }
      );
    }

    // Flatten district/school data for the frontend
    const { district, school, ...rest } = vacancy;
    return NextResponse.json({
      ...rest,
      leaid: rest.leaid,
      districtName: district?.name ?? null,
      schoolName: school?.schoolName ?? null,
    });
  } catch (error) {
    console.error("Error fetching vacancy:", error);
    return NextResponse.json(
      { error: "Failed to fetch vacancy" },
      { status: 500 }
    );
  }
}

// PATCH /api/vacancies/[id] - Update a vacancy's status, category, and/or notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.vacancy.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Vacancy not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, category, notes } = body;

    // Reject any unexpected fields
    const allowedFields = ["status", "category", "notes"];
    const extraFields = Object.keys(body).filter(
      (key) => !allowedFields.includes(key)
    );
    if (extraFields.length > 0) {
      return NextResponse.json(
        {
          error: `Unexpected fields: ${extraFields.join(", ")}. Only status, category, and notes can be updated.`,
        },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (
      status !== undefined &&
      !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])
    ) {
      return NextResponse.json(
        {
          error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate category if provided (allow null to clear)
    if (
      category !== undefined &&
      category !== null &&
      !VALID_CATEGORIES.includes(
        category as (typeof VALID_CATEGORIES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const vacancy = await prisma.vacancy.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(category !== undefined && { category }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });

    return NextResponse.json(vacancy);
  } catch (error) {
    console.error("Error updating vacancy:", error);
    return NextResponse.json(
      { error: "Failed to update vacancy" },
      { status: 500 }
    );
  }
}
