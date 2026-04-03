import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const executionId = parseInt(id, 10);
    const body = await request.json();
    const { stepExecutionId, notes } = body;

    const stepExec = await prisma.stepExecution.findUnique({
      where: { id: stepExecutionId },
      include: {
        contact: { select: { id: true, name: true, leaid: true } },
        step: { select: { type: true } },
      },
    });

    if (!stepExec || stepExec.executionId !== executionId) {
      return NextResponse.json(
        { error: "Step execution not found" },
        { status: 404 }
      );
    }

    if (stepExec.status === "completed") {
      return NextResponse.json(
        { error: "Step already completed" },
        { status: 400 }
      );
    }

    // Create Activity for manual step
    const activityType = stepExec.step.type === "call" ? "call" : `${stepExec.step.type}_sent`;
    const activity = await prisma.activity.create({
      data: {
        type: activityType,
        title: `${stepExec.step.type} — ${stepExec.contact.name}`,
        notes: notes || null,
        source: "engage",
        startDate: new Date(),
        status: "completed",
        createdByUserId: user.id,
      },
    });

    // Link to contact and district
    await Promise.all([
      prisma.activityContact.create({
        data: { activityId: activity.id, contactId: stepExec.contact.id },
      }),
      stepExec.contact.leaid
        ? prisma.activityDistrict.create({
            data: { activityId: activity.id, districtLeaid: stepExec.contact.leaid },
          })
        : Promise.resolve(),
    ]);

    // Update step execution
    await prisma.stepExecution.update({
      where: { id: stepExecutionId },
      data: {
        status: "completed",
        notes: notes || null,
        activityId: activity.id,
        completedAt: new Date(),
      },
    });

    // Advance execution
    const completedCount = await prisma.stepExecution.count({
      where: { executionId, status: { in: ["completed", "skipped"] } },
    });

    const nextPending = await prisma.stepExecution.findFirst({
      where: { executionId, status: "pending" },
      include: { step: { select: { position: true } } },
      orderBy: [{ step: { position: "asc" } }, { contactId: "asc" }],
    });

    if (!nextPending) {
      await prisma.sequenceExecution.update({
        where: { id: executionId },
        data: { status: "completed", completedCount, completedAt: new Date() },
      });
    } else {
      const allForStep = await prisma.stepExecution.findMany({
        where: { executionId, stepId: nextPending.stepId },
        orderBy: { contactId: "asc" },
        select: { id: true },
      });
      const contactIndex = allForStep.findIndex((se) => se.id === nextPending.id);

      await prisma.sequenceExecution.update({
        where: { id: executionId },
        data: {
          completedCount,
          currentStepPosition: nextPending.step.position,
          currentContactIndex: Math.max(0, contactIndex),
        },
      });
    }

    return NextResponse.json({ success: true, activityId: activity.id });
  } catch (error) {
    console.error("Error completing step:", error);
    return NextResponse.json(
      { error: "Failed to complete step" },
      { status: 500 }
    );
  }
}
