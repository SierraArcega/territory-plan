import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/vacancy-config/[id]
 *
 * Update an existing VacancyKeywordConfig row.
 *
 * Request body: {
 *   type?: "relevance" | "exclusion",
 *   label?: string,
 *   keywords?: string[],
 *   serviceLine?: string | null
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json(
        { error: "Invalid config ID" },
        { status: 400 }
      );
    }

    // Check if config exists
    const existing = await prisma.vacancyKeywordConfig.findUnique({
      where: { id: configId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Vacancy keyword config not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { type, label, keywords, serviceLine } = body as {
      type?: string;
      label?: string;
      keywords?: string[];
      serviceLine?: string | null;
    };

    // Validate type if provided
    if (type !== undefined && !["relevance", "exclusion"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'relevance' or 'exclusion'" },
        { status: 400 }
      );
    }

    // Validate label if provided
    if (label !== undefined && (typeof label !== "string" || label.trim().length === 0)) {
      return NextResponse.json(
        { error: "label must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate keywords if provided
    if (keywords !== undefined) {
      if (!Array.isArray(keywords) || keywords.length === 0) {
        return NextResponse.json(
          { error: "keywords must be a non-empty array" },
          { status: 400 }
        );
      }
      if (!keywords.every((k) => typeof k === "string" && k.trim().length > 0)) {
        return NextResponse.json(
          { error: "All keywords must be non-empty strings" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: {
      type?: string;
      label?: string;
      keywords?: string[];
      serviceLine?: string | null;
    } = {};

    if (type !== undefined) updateData.type = type;
    if (label !== undefined) updateData.label = label.trim();
    if (keywords !== undefined) updateData.keywords = keywords.map((k) => k.trim());
    if (serviceLine !== undefined) updateData.serviceLine = serviceLine?.trim() ?? null;

    const config = await prisma.vacancyKeywordConfig.update({
      where: { id: configId },
      data: updateData,
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error updating vacancy keyword config:", error);
    return NextResponse.json(
      { error: "Failed to update vacancy keyword config" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/vacancy-config/[id]
 *
 * Delete a VacancyKeywordConfig row.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json(
        { error: "Invalid config ID" },
        { status: 400 }
      );
    }

    // Check if config exists
    const existing = await prisma.vacancyKeywordConfig.findUnique({
      where: { id: configId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Vacancy keyword config not found" },
        { status: 404 }
      );
    }

    await prisma.vacancyKeywordConfig.delete({
      where: { id: configId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vacancy keyword config:", error);
    return NextResponse.json(
      { error: "Failed to delete vacancy keyword config" },
      { status: 500 }
    );
  }
}
