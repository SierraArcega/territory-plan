import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Add a step to a sequence
export async function POST(
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
    const { type, templateId, subject, body: stepBody, delayDays, metadata } = body;

    if (!type || typeof type !== "string") {
      return NextResponse.json({ error: "Step type is required" }, { status: 400 });
    }

    if (!templateId && !stepBody) {
      return NextResponse.json(
        { error: "Either templateId or body is required" },
        { status: 400 }
      );
    }

    // Verify the sequence exists
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      select: { id: true },
    });

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    // Calculate next position
    const lastStep = await prisma.sequenceStep.findFirst({
      where: { sequenceId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPosition = (lastStep?.position ?? -1) + 1;

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId,
        type,
        templateId: templateId ?? null,
        subject: subject ?? null,
        body: stepBody ?? null,
        position: nextPosition,
        delayDays: delayDays ?? 0,
        metadata: metadata ?? null,
      },
      include: { template: true },
    });

    return NextResponse.json({ step }, { status: 201 });
  } catch (error) {
    console.error("Failed to add step:", error);
    return NextResponse.json(
      { error: "Failed to add step" },
      { status: 500 }
    );
  }
}

// Reorder steps in a sequence
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
    const { stepOrder } = body;

    if (!Array.isArray(stepOrder) || stepOrder.length === 0) {
      return NextResponse.json(
        { error: "stepOrder must be a non-empty array of step IDs" },
        { status: 400 }
      );
    }

    // Update all positions in a transaction
    await prisma.$transaction(
      stepOrder.map((stepId: number, index: number) =>
        prisma.sequenceStep.update({
          where: { id: stepId },
          data: { position: index },
        })
      )
    );

    // Return updated steps
    const steps = await prisma.sequenceStep.findMany({
      where: { sequenceId },
      orderBy: { position: "asc" },
      include: { template: true },
    });

    return NextResponse.json({ steps });
  } catch (error) {
    console.error("Failed to reorder steps:", error);
    return NextResponse.json(
      { error: "Failed to reorder steps" },
      { status: 500 }
    );
  }
}
