import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isValidPersona, isValidSeniorityLevel } from "@/lib/contactTypes";

export const dynamic = "force-dynamic";

// Search/list contacts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        district: { select: { name: true, leaid: true } },
      },
    });

    // Flatten district info into the response
    const result = contacts.map((c) => ({
      id: c.id,
      leaid: c.leaid,
      name: c.name,
      title: c.title,
      email: c.email,
      phone: c.phone,
      isPrimary: c.isPrimary,
      districtName: c.district?.name ?? null,
    }));

    return NextResponse.json({ contacts: result, total: result.length });
  } catch (error) {
    console.error("Error listing contacts:", error);
    return NextResponse.json(
      { error: "Failed to list contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leaid, salutation, name, title, email, phone, isPrimary, linkedinUrl, persona, seniorityLevel } = body;

    if (!leaid || !name) {
      return NextResponse.json(
        { error: "leaid and name are required" },
        { status: 400 }
      );
    }

    // Validate persona if provided
    if (persona && !isValidPersona(persona)) {
      return NextResponse.json(
        { error: "Invalid persona value" },
        { status: 400 }
      );
    }

    // Validate seniority level if provided
    if (seniorityLevel && !isValidSeniorityLevel(seniorityLevel)) {
      return NextResponse.json(
        { error: "Invalid seniority level value" },
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
        salutation: salutation || null,
        name,
        title: title || null,
        email: email || null,
        phone: phone || null,
        isPrimary: isPrimary || false,
        linkedinUrl: linkedinUrl || null,
        persona: persona || null,
        seniorityLevel: seniorityLevel || null,
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
