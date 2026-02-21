import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidPersona, isValidSeniorityLevel } from "@/features/shared/types/contact-types";

export const dynamic = "force-dynamic";

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
