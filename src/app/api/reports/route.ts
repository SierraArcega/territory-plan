// GET /api/reports — List saved reports for current user (owned + shared)
// POST /api/reports — Create a new saved report

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reports = await prisma.savedReport.findMany({
      where: {
        OR: [
          { createdBy: user.id },
          { sharedWith: { has: user.id } },
        ],
      },
      orderBy: { updatedAt: "desc" },
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

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Error listing reports:", error);
    return NextResponse.json(
      { error: "Failed to list reports" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, source, config } = body as {
      name: string;
      source: string;
      config: Prisma.InputJsonValue;
    };

    if (!name || !source || !config) {
      return NextResponse.json(
        { error: "Name, source, and config are required" },
        { status: 400 }
      );
    }

    const report = await prisma.savedReport.create({
      data: {
        name,
        source,
        config,
        createdBy: user.id,
      },
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

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}
