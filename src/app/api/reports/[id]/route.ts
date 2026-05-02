import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteArgs = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteArgs): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const report = await prisma.savedReport.findUnique({ where: { id: Number(id) } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ report });
}

export async function PATCH(req: NextRequest, { params }: RouteArgs): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.savedReport.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<{
    title: string;
    sql: string;
    summary: unknown;
    question: string;
    description: string | null;
    isTeamPinned: boolean;
  }>;

  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  const isAdmin = profile?.role === "admin";
  const isOwner = existing.userId === user.id;

  const wantsContentEdit =
    body.title !== undefined ||
    body.sql !== undefined ||
    body.summary !== undefined ||
    body.question !== undefined ||
    body.description !== undefined;
  const wantsPinToggle = body.isTeamPinned !== undefined;

  if (wantsContentEdit && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (wantsPinToggle && !isAdmin) {
    return NextResponse.json(
      { error: "Only admins can pin reports to the team" },
      { status: 403 },
    );
  }

  const data: Prisma.SavedReportUpdateInput = {};
  if (isOwner && wantsContentEdit) {
    if (body.title !== undefined) data.title = body.title;
    if (body.question !== undefined) data.question = body.question;
    if (body.sql !== undefined) data.sql = body.sql;
    if (body.summary !== undefined) data.summary = body.summary as object;
    if (body.description !== undefined) data.description = body.description;
  }
  if (isAdmin && wantsPinToggle) {
    data.isTeamPinned = body.isTeamPinned;
    data.pinnedBy = body.isTeamPinned ? user.id : null;
  }

  const report = await prisma.savedReport.update({
    where: { id: existing.id },
    data,
  });
  return NextResponse.json({ report });
}

export async function DELETE(_req: NextRequest, { params }: RouteArgs): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.savedReport.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.savedReport.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
