import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteArgs = { params: Promise<{ id: string }> };

async function findOwned(id: number, userId: string) {
  const r = await prisma.savedReport.findUnique({ where: { id } });
  return r && r.userId === userId ? r : null;
}

export async function GET(_req: NextRequest, { params }: RouteArgs): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const report = await findOwned(Number(id), user.id);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ report });
}

export async function PATCH(req: NextRequest, { params }: RouteArgs): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await findOwned(Number(id), user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<{ title: string; sql: string; summary: unknown; question: string }>;
  const report = await prisma.savedReport.update({
    where: { id: existing.id },
    data: {
      title: body.title ?? undefined,
      question: body.question ?? undefined,
      sql: body.sql ?? undefined,
      summary: (body.summary as object | undefined) ?? undefined,
    },
  });
  return NextResponse.json({ report });
}

export async function DELETE(_req: NextRequest, { params }: RouteArgs): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await findOwned(Number(id), user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.savedReport.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
