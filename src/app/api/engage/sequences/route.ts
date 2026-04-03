import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// List sequences (exclude archived)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sequences = await prisma.sequence.findMany({
      where: { isArchived: false },
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
        mergeFieldDefs: true,
        _count: { select: { executions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ sequences });
  } catch (error) {
    console.error("Failed to list sequences:", error);
    return NextResponse.json(
      { error: "Failed to list sequences" },
      { status: 500 }
    );
  }
}

// Create a new sequence
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const sequence = await prisma.sequence.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        createdByUserId: user.id,
      },
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
        mergeFieldDefs: true,
        _count: { select: { executions: true } },
      },
    });

    return NextResponse.json({ sequence }, { status: 201 });
  } catch (error) {
    console.error("Failed to create sequence:", error);
    return NextResponse.json(
      { error: "Failed to create sequence" },
      { status: 500 }
    );
  }
}
