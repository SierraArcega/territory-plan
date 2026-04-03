import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const execution = await prisma.sequenceExecution.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        sequence: {
          select: {
            name: true,
            steps: {
              orderBy: { position: "asc" },
              include: { template: true },
            },
          },
        },
        stepExecutions: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, title: true, leaid: true },
            },
            step: { select: { position: true, type: true } },
          },
          orderBy: [{ step: { position: "asc" } }, { contactId: "asc" }],
        },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    return NextResponse.json(execution);
  } catch (error) {
    console.error("Error fetching execution:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const validStatuses = ["active", "paused", "completed", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (status) {
      data.status = status;
      if (status === "completed" || status === "cancelled") {
        data.completedAt = new Date();
      }
    }

    const execution = await prisma.sequenceExecution.update({
      where: { id: parseInt(id, 10) },
      data,
    });

    return NextResponse.json(execution);
  } catch (error) {
    console.error("Error updating execution:", error);
    return NextResponse.json(
      { error: "Failed to update execution" },
      { status: 500 }
    );
  }
}
