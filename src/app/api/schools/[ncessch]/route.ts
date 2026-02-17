import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

// Helper to convert Decimal to number (handles null)
function toNumber(val: Decimal | null | undefined): number | null {
  return val != null ? Number(val) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ncessch: string }> }
) {
  try {
    const { ncessch } = await params;

    const school = await prisma.school.findUnique({
      where: { ncessch },
      include: {
        enrollmentHistory: {
          orderBy: { year: "asc" },
        },
        schoolTags: {
          include: { tag: true },
        },
        schoolContacts: {
          include: { contact: true },
        },
        district: {
          select: { leaid: true, name: true },
        },
      },
    });

    if (!school) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    const response = {
      ncessch: school.ncessch,
      leaid: school.leaid,
      schoolName: school.schoolName,
      charter: school.charter,
      schoolLevel: school.schoolLevel,
      schoolType: school.schoolType,
      lograde: school.lograde,
      higrade: school.higrade,
      schoolStatus: school.schoolStatus,
      latitude: toNumber(school.latitude),
      longitude: toNumber(school.longitude),
      streetAddress: school.streetAddress,
      city: school.city,
      stateAbbrev: school.stateAbbrev,
      zip: school.zip,
      countyName: school.countyName,
      phone: school.phone,
      urbanCentricLocale: school.urbanCentricLocale,
      enrollment: school.enrollment,
      directoryDataYear: school.directoryDataYear,
      owner: school.owner,
      notes: school.notes,
      notesUpdatedAt: school.notesUpdatedAt?.toISOString() ?? null,
      createdAt: school.createdAt.toISOString(),
      updatedAt: school.updatedAt.toISOString(),

      enrollmentHistory: school.enrollmentHistory.map((eh) => ({
        year: eh.year,
        enrollment: eh.enrollment,
      })),

      tags: school.schoolTags.map((st) => ({
        id: st.tag.id,
        name: st.tag.name,
        color: st.tag.color,
      })),

      contacts: school.schoolContacts.map((sc) => ({
        id: sc.contact.id,
        name: sc.contact.name,
        title: sc.contact.title,
        email: sc.contact.email,
        phone: sc.contact.phone,
      })),

      district: {
        leaid: school.district.leaid,
        name: school.district.name,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching school detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch school" },
      { status: 500 }
    );
  }
}
