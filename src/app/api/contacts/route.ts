import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leaid, name, title, email, phone, isPrimary } = body;

    if (!leaid || !name) {
      return NextResponse.json(
        { error: "leaid and name are required" },
        { status: 400 }
      );
    }

    // Verify district exists
    const district = await prisma.district.findUnique({
      where: { leaid },
    });

    if (!district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary) {
      await prisma.contact.updateMany({
        where: { leaid, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.contact.create({
      data: {
        leaid,
        name,
        title: title || null,
        email: email || null,
        phone: phone || null,
        isPrimary: isPrimary || false,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
