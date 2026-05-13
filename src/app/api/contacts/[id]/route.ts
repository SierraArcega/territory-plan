import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidPersona, isValidSeniorityLevel } from "@/features/shared/types/contact-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[id]
 *
 * Detail-panel data for a single contact. Returns the contact row plus the
 * joined district (name + state) — the panel header shows
 * "{role} · {district}" so we need both in one round-trip.
 *
 * Added in Phase D for the Saved Views detail panel; the rest of this file
 * predates the feature and handles legacy PUT/DELETE flows.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const contactId = parseInt(id, 10);
    if (!Number.isFinite(contactId)) {
      return NextResponse.json({ error: "Invalid contact ID" }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        district: {
          select: { leaid: true, name: true, stateAbbrev: true },
        },
      },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: contact.id,
      leaid: contact.leaid,
      salutation: contact.salutation,
      name: contact.name,
      title: contact.title,
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.isPrimary,
      linkedinUrl: contact.linkedinUrl,
      persona: contact.persona,
      seniorityLevel: contact.seniorityLevel,
      district: contact.district
        ? {
            leaid: contact.district.leaid,
            name: contact.district.name,
            stateAbbrev: contact.district.stateAbbrev,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching contact:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contactId = parseInt(id);

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: "Invalid contact ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { salutation, name, title, email, phone, isPrimary, linkedinUrl, persona, seniorityLevel } = body;

    // Validate persona if provided (allow empty string to clear)
    if (persona && !isValidPersona(persona)) {
      return NextResponse.json(
        { error: "Invalid persona value" },
        { status: 400 }
      );
    }

    // Validate seniority level if provided (allow empty string to clear)
    if (seniorityLevel && !isValidSeniorityLevel(seniorityLevel)) {
      return NextResponse.json(
        { error: "Invalid seniority level value" },
        { status: 400 }
      );
    }

    // Get existing contact
    const existing = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary && !existing.isPrimary) {
      await prisma.contact.updateMany({
        where: { leaid: existing.leaid, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        salutation: salutation !== undefined ? salutation : undefined,
        name: name !== undefined ? name : undefined,
        title: title !== undefined ? title : undefined,
        email: email !== undefined ? email : undefined,
        phone: phone !== undefined ? phone : undefined,
        isPrimary: isPrimary !== undefined ? isPrimary : undefined,
        linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : undefined,
        persona: persona !== undefined ? persona : undefined,
        seniorityLevel: seniorityLevel !== undefined ? seniorityLevel : undefined,
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contactId = parseInt(id);

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: "Invalid contact ID" },
        { status: 400 }
      );
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
