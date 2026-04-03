import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Update a step
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, stepId: stepIdStr } = await params;
    const sequenceId = parseInt(id, 10);
    const stepId = parseInt(stepIdStr, 10);
    if (isNaN(sequenceId) || isNaN(stepId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.type !== undefined) data.type = body.type;
    if (body.delayDays !== undefined) data.delayDays = body.delayDays;
    if (body.metadata !== undefined) data.metadata = body.metadata;

    // If switching to a template, clear inline fields
    if (body.templateId !== undefined) {
      data.templateId = body.templateId;
      if (body.templateId !== null) {
        data.subject = null;
        data.body = null;
      }
    }

    // Only set inline fields if not switching to a template
    if (body.templateId === undefined || body.templateId === null) {
      if (body.subject !== undefined) data.subject = body.subject;
      if (body.body !== undefined) data.body = body.body;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Verify step belongs to this sequence
    const existing = await prisma.sequenceStep.findFirst({
      where: { id: stepId, sequenceId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    const step = await prisma.sequenceStep.update({
      where: { id: stepId },
      data,
      include: { template: true },
    });

    return NextResponse.json({ step });
  } catch (error) {
    console.error("Failed to update step:", error);
    return NextResponse.json(
      { error: "Failed to update step" },
      { status: 500 }
    );
  }
}

// Delete a step and reindex remaining positions
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, stepId: stepIdStr } = await params;
    const sequenceId = parseInt(id, 10);
    const stepId = parseInt(stepIdStr, 10);
    if (isNaN(sequenceId) || isNaN(stepId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Verify step belongs to this sequence
    const existing = await prisma.sequenceStep.findFirst({
      where: { id: stepId, sequenceId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Delete the step
      await tx.sequenceStep.delete({ where: { id: stepId } });

      // Get remaining steps ordered by position
      const remaining = await tx.sequenceStep.findMany({
        where: { sequenceId },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      // Reindex positions starting from 0
      for (let i = 0; i < remaining.length; i++) {
        await tx.sequenceStep.update({
          where: { id: remaining[i].id },
          data: { position: i },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete step:", error);
    return NextResponse.json(
      { error: "Failed to delete step" },
      { status: 500 }
    );
  }
}
