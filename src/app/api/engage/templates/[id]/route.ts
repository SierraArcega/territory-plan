import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_TEMPLATE_TYPES = ["email", "call", "text", "linkedin"] as const;

// GET /api/engage/templates/[id] - Fetch a single template
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const template = await prisma.engageTemplate.findFirst({
      where: {
        id: templateId,
        createdByUserId: user.id,
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch template: ${detail}` },
      { status: 500 }
    );
  }
}

// PATCH /api/engage/templates/[id] - Update a template
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
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.engageTemplate.findFirst({
      where: {
        id: templateId,
        createdByUserId: user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, type, subject, body: templateBody, isArchived } = body;

    // Validate type if provided
    if (type && !VALID_TEMPLATE_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid template type: ${type}. Must be one of: ${VALID_TEMPLATE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const data: {
      name?: string;
      type?: string;
      subject?: string;
      body?: string;
      isArchived?: boolean;
    } = {};

    if (name !== undefined) data.name = name.trim();
    if (type !== undefined) data.type = type;
    if (subject !== undefined) data.subject = subject.trim();
    if (templateBody !== undefined) data.body = templateBody.trim();
    if (isArchived !== undefined) data.isArchived = isArchived;

    const template = await prisma.engageTemplate.update({
      where: { id: templateId },
      data,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to update template: ${detail}` },
      { status: 500 }
    );
  }
}

// DELETE /api/engage/templates/[id] - Soft-delete a template (archive)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);

    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.engageTemplate.findFirst({
      where: {
        id: templateId,
        createdByUserId: user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const template = await prisma.engageTemplate.update({
      where: { id: templateId },
      data: { isArchived: true },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error deleting template:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to delete template: ${detail}` },
      { status: 500 }
    );
  }
}
