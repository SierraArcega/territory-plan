import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Fetch a single sequence
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const sequenceId = parseInt(id, 10);
    if (isNaN(sequenceId)) {
      return NextResponse.json({ error: "Invalid sequence ID" }, { status: 400 });
    }

    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
        mergeFieldDefs: true,
        _count: { select: { executions: true } },
      },
    });

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    return NextResponse.json({ sequence });
  } catch (error) {
    console.error("Failed to fetch sequence:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequence" },
      { status: 500 }
    );
  }
}

// Update a sequence
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const sequenceId = parseInt(id, 10);
    if (isNaN(sequenceId)) {
      return NextResponse.json({ error: "Invalid sequence ID" }, { status: 400 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.isArchived !== undefined) data.isArchived = Boolean(body.isArchived);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const sequence = await prisma.sequence.update({
      where: { id: sequenceId },
      data,
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
        mergeFieldDefs: true,
        _count: { select: { executions: true } },
      },
    });

    return NextResponse.json({ sequence });
  } catch (error) {
    console.error("Failed to update sequence:", error);
    return NextResponse.json(
      { error: "Failed to update sequence" },
      { status: 500 }
    );
  }
}

// Soft-delete a sequence
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const sequenceId = parseInt(id, 10);
    if (isNaN(sequenceId)) {
      return NextResponse.json({ error: "Invalid sequence ID" }, { status: 400 });
    }

    await prisma.sequence.update({
      where: { id: sequenceId },
      data: { isArchived: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to archive sequence:", error);
    return NextResponse.json(
      { error: "Failed to archive sequence" },
      { status: 500 }
    );
  }
}
