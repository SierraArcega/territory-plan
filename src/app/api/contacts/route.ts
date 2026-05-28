import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createContact } from "@/features/contacts/lib/service";
import { isServiceError } from "@/features/shared/lib/service-error";

export const dynamic = "force-dynamic";

// Search/list contacts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const leaid = searchParams.get("leaid");
    // Saved-views: comma-separated leaid set (preferred for plan/list scope).
    const leaidsArg = searchParams.get("leaids");
    const leaids = leaidsArg
      ? leaidsArg.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (leaid) {
      where.leaid = leaid;
    } else if (leaids && leaids.length > 0) {
      where.leaid = { in: leaids };
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
    const contact = await createContact(body);
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
