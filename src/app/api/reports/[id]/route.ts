// GET /api/reports/[id] — Load a specific saved report
// PUT /api/reports/[id] — Update a saved report (owner only)
// DELETE /api/reports/[id] — Delete a saved report (owner only)

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const report = await prisma.savedReport.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        source: true,
        config: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        sharedWith: true,
        creator: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Auth: owner or shared
    if (report.createdBy !== user.id && !report.sharedWith.includes(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Check ownership
    const existing = await prisma.savedReport.findUnique({
      where: { id },
      select: { createdBy: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (existing.createdBy !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, source, config } = body as {
      name?: string;
      source?: string;
      config?: Prisma.InputJsonValue;
    };

    const updateData: Prisma.SavedReportUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (source !== undefined) updateData.source = source;
    if (config !== undefined) updateData.config = config;

    const report = await prisma.savedReport.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        source: true,
        config: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        sharedWith: true,
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Check ownership
    const existing = await prisma.savedReport.findUnique({
      where: { id },
      select: { createdBy: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (existing.createdBy !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.savedReport.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting report:", error);
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 }
    );
  }
}
