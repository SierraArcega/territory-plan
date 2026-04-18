import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { validateParams } from "@/features/reports/lib/params-validator";
import type { QueryParams } from "@/features/reports/lib/types";

export const dynamic = "force-dynamic";

// GET /api/ai/query/draft — current user's active draft (or 404 if none).
export async function GET(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const draft = await prisma.reportDraft.findUnique({
    where: { userId: user.id },
  });
  if (!draft) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json(draft);
}

interface PutBody {
  params?: QueryParams;
  conversationId?: string | null;
  chatHistory?: unknown;
}

// PUT /api/ai/query/draft — upsert the current user's draft.
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.params) {
    return NextResponse.json({ error: "Missing 'params'" }, { status: 400 });
  }
  // Drafts can be half-built; validate but allow inflight shapes.
  // We still enforce the hard constraints (registered table, valid ops, etc.)
  // because storing garbage would poison every later replay.
  const validation = validateParams(body.params);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid params", details: validation.errors },
      { status: 400 },
    );
  }

  const draft = await prisma.reportDraft.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      params: validation.normalized as unknown as object,
      conversationId: body.conversationId ?? undefined,
      chatHistory: (body.chatHistory as object | null | undefined) ?? undefined,
    },
    update: {
      params: validation.normalized as unknown as object,
      conversationId: body.conversationId ?? undefined,
      chatHistory: (body.chatHistory as object | null | undefined) ?? undefined,
    },
  });
  return NextResponse.json(draft);
}

// DELETE /api/ai/query/draft — discard the current user's draft.
export async function DELETE(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.reportDraft.deleteMany({ where: { userId: user.id } });
  return new NextResponse(null, { status: 204 });
}
