import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reportId = Number(request.nextUrl.searchParams.get("reportId") ?? "0");

  const draft = await prisma.reportDraft.findUnique({
    where: { userId_reportId: { userId: user.id, reportId } },
  });

  if (!draft) return NextResponse.json({ draft: null });

  return NextResponse.json({
    draft: {
      ...draft,
      lastTouchedAt: draft.lastTouchedAt.toISOString(),
      createdAt: draft.createdAt.toISOString(),
    },
  });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    reportId: number;
    params: object;
    conversationId?: string | null;
    chatHistory: unknown[];
  };

  await prisma.reportDraft.upsert({
    where: { userId_reportId: { userId: user.id, reportId: body.reportId } },
    create: {
      userId: user.id,
      reportId: body.reportId,
      params: body.params,
      conversationId: body.conversationId ?? null,
      chatHistory: body.chatHistory as object[],
    },
    update: {
      params: body.params,
      conversationId: body.conversationId ?? null,
      chatHistory: body.chatHistory as object[],
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reportId = Number(request.nextUrl.searchParams.get("reportId") ?? "0");

  try {
    await prisma.reportDraft.delete({
      where: { userId_reportId: { userId: user.id, reportId } },
    });
  } catch (e) {
    // P2025 = record not found — deletion is idempotent
    if ((e as { code?: string }).code !== "P2025") throw e;
  }

  return NextResponse.json({ ok: true });
}
