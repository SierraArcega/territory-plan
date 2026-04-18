import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { validateParams } from "@/features/reports/lib/params-validator";
import type { QueryParams } from "@/features/reports/lib/types";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function loadActor(userId: string) {
  return prisma.userProfile.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/ai/query/reports/[id]
export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: idRaw } = await params;
  const id = parseId(idRaw);
  if (id === null) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  const report = await prisma.savedReport.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(report);
}

interface PatchBody {
  title?: string;
  description?: string;
  params?: QueryParams;
  isTeamPinned?: boolean;
}

// PATCH /api/ai/query/reports/[id]
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: idRaw } = await params;
  const id = parseId(idRaw);
  if (id === null) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existing = await prisma.savedReport.findUnique({
    where: { id },
    select: { id: true, userId: true, isTeamPinned: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actor = await loadActor(user.id);
  const isAdmin = actor?.role === "admin";
  const isOwner = existing.userId === user.id;

  // Pin toggle requires admin.
  const wantsPinChange =
    body.isTeamPinned !== undefined && body.isTeamPinned !== existing.isTeamPinned;
  if (wantsPinChange && !isAdmin) {
    return NextResponse.json(
      { error: "Only admins can pin or unpin reports" },
      { status: 403 },
    );
  }

  // Non-pin edits require ownership or admin.
  const wantsContentChange =
    body.title !== undefined ||
    body.description !== undefined ||
    body.params !== undefined;
  if (wantsContentChange && !isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Only the author or an admin can edit this report" },
      { status: 403 },
    );
  }

  const data: {
    title?: string;
    params?: object;
    isTeamPinned?: boolean;
    pinnedBy?: string | null;
  } = {};
  if (body.title !== undefined) {
    const trimmed = body.title.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    data.title = trimmed;
  }
  if (body.params !== undefined) {
    const validation = validateParams(body.params);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid params", details: validation.errors },
        { status: 400 },
      );
    }
    data.params = validation.normalized as unknown as object;
  }
  if (wantsPinChange) {
    data.isTeamPinned = body.isTeamPinned ?? false;
    data.pinnedBy = body.isTeamPinned ? user.id : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const updated = await prisma.savedReport.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

// DELETE /api/ai/query/reports/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: idRaw } = await params;
  const id = parseId(idRaw);
  if (id === null) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  const existing = await prisma.savedReport.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actor = await loadActor(user.id);
  const isAdmin = actor?.role === "admin";
  const isOwner = existing.userId === user.id;
  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Only the author or an admin can delete this report" },
      { status: 403 },
    );
  }

  await prisma.savedReport.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
