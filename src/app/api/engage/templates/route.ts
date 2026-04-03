import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_TEMPLATE_TYPES = ["email", "call", "text", "linkedin"] as const;
type TemplateType = (typeof VALID_TEMPLATE_TYPES)[number];

// GET /api/engage/templates - List templates with optional filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as TemplateType | null;

    const where: {
      createdByUserId: string;
      isArchived?: boolean;
      type?: string;
    } = {
      createdByUserId: user.id,
      isArchived: false,
    };

    if (type) {
      if (!VALID_TEMPLATE_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Invalid template type: ${type}. Must be one of: ${VALID_TEMPLATE_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      where.type = type;
    }

    const templates = await prisma.engageTemplate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch templates: ${detail}` },
      { status: 500 }
    );
  }
}

// POST /api/engage/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, subject, body: templateBody } = body;

    // Validate required fields
    if (!name || !type || !subject || !templateBody) {
      return NextResponse.json(
        { error: "name, type, subject, and body are required" },
        { status: 400 }
      );
    }

    // Validate type
    if (!VALID_TEMPLATE_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid template type: ${type}. Must be one of: ${VALID_TEMPLATE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const template = await prisma.engageTemplate.create({
      data: {
        name: name.trim(),
        type,
        subject: subject.trim(),
        body: templateBody.trim(),
        createdByUserId: user.id,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create template: ${detail}` },
      { status: 500 }
    );
  }
}
