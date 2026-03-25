import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/territory-plans/[id]/contacts - Get all contacts for districts in the plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Team shares visibility across plans (matches list endpoint)
    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        districts: {
          select: {
            districtLeaid: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Get all leaids for districts in this plan
    const leaids = plan.districts.map((d) => d.districtLeaid);

    if (leaids.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch all contacts for these districts
    const contacts = await prisma.contact.findMany({
      where: {
        leaid: { in: leaids },
      },
      orderBy: [
        { isPrimary: "desc" },
        { name: "asc" },
      ],
    });

    // De-duplicate by email: keep only the first contact per email address.
    // Contacts without email are always included. The ordering (isPrimary DESC)
    // ensures the primary contact is kept when duplicates exist.
    const seenEmails = new Set<string>();
    const dedupedContacts = contacts.filter((c) => {
      if (!c.email) return true;
      const lower = c.email.toLowerCase();
      if (seenEmails.has(lower)) return false;
      seenEmails.add(lower);
      return true;
    });

    return NextResponse.json(
      dedupedContacts.map((c) => ({
        id: c.id,
        leaid: c.leaid,
        salutation: c.salutation,
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        isPrimary: c.isPrimary,
        linkedinUrl: c.linkedinUrl,
        persona: c.persona,
        seniorityLevel: c.seniorityLevel,
        createdAt: c.createdAt.toISOString(),
        lastEnrichedAt: c.lastEnrichedAt?.toISOString() ?? null,
      }))
    );
  } catch (error) {
    console.error("Error fetching plan contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}
