import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/vacancy-config
 *
 * Return all VacancyKeywordConfig rows.
 */
export async function GET() {
  try {
    const configs = await prisma.vacancyKeywordConfig.findMany({
      orderBy: [{ type: "asc" }, { label: "asc" }],
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Error fetching vacancy keyword configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch vacancy keyword configs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/vacancy-config
 *
 * Create a new VacancyKeywordConfig row.
 *
 * Request body: {
 *   type: "relevance" | "exclusion",
 *   label: string,
 *   keywords: string[],
 *   serviceLine?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, label, keywords, serviceLine } = body as {
      type?: string;
      label?: string;
      keywords?: string[];
      serviceLine?: string;
    };

    // Validate required fields
    if (!type || !["relevance", "exclusion"].includes(type)) {
      return NextResponse.json(
        { error: "type is required and must be 'relevance' or 'exclusion'" },
        { status: 400 }
      );
    }

    if (!label || typeof label !== "string" || label.trim().length === 0) {
      return NextResponse.json(
        { error: "label is required" },
        { status: 400 }
      );
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "keywords is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate all keywords are strings
    if (!keywords.every((k) => typeof k === "string" && k.trim().length > 0)) {
      return NextResponse.json(
        { error: "All keywords must be non-empty strings" },
        { status: 400 }
      );
    }

    const config = await prisma.vacancyKeywordConfig.create({
      data: {
        type,
        label: label.trim(),
        keywords: keywords.map((k) => k.trim()),
        serviceLine: serviceLine?.trim() ?? null,
      },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    console.error("Error creating vacancy keyword config:", error);
    return NextResponse.json(
      { error: "Failed to create vacancy keyword config" },
      { status: 500 }
    );
  }
}
