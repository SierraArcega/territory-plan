import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { createListBodySchema } from "@/lib/saved-views/schema";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/lists
 *
 * Returns lists the current user can see:
 *   - their own (any `shared` value)
 *   - any shared list owned by another user
 *
 * Per-user hidden lists are filtered out unless `?showHidden=1`. Hidden state
 * is per-user, lookups join through `saved_list_hidden`.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const showHidden = searchParams.get("showHidden") === "1";

  // Visibility: owner OR shared
  const where: Prisma.SavedListWhereInput = {
    OR: [{ ownerId: user.id }, { shared: true }],
  };

  const lists = await prisma.savedList.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      hidden: { where: { userId: user.id }, select: { hiddenAt: true } },
    },
  });

  const result = lists
    .filter((l) => showHidden || l.hidden.length === 0)
    .map((l) => ({
      id: l.id,
      name: l.name,
      source: l.source,
      filterTree: l.filterTree,
      scopeMode: l.scopeMode,
      scopeFilterTree: l.scopeFilterTree,
      scopeRefKind: l.scopeRefKind,
      scopeRefId: l.scopeRefId,
      shared: l.shared,
      ownerId: l.ownerId,
      owner: l.owner
        ? { id: l.owner.id, fullName: l.owner.fullName, avatarUrl: l.owner.avatarUrl }
        : null,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      hidden: l.hidden.length > 0,
    }));

  return NextResponse.json({ lists: result });
}

/**
 * POST /api/lists
 *
 * Creates a new SavedList owned by the current user. Validates the
 * filterTree shape with the shared Zod schema. Field/op allowlist
 * enforcement happens at preview/fetch time, not here — the persisted
 * tree may contain custom client-only fields in v1.1+, so we only
 * structurally validate at this boundary.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createListBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid list body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Cross-field constraint: scopeMode='reference' requires scopeRefKind + scopeRefId.
  if (data.scopeMode === "reference") {
    if (!data.scopeRefKind || !data.scopeRefId) {
      return NextResponse.json(
        { error: "scope mode 'reference' requires scopeRefKind and scopeRefId" },
        { status: 400 },
      );
    }
  }

  const list = await prisma.savedList.create({
    data: {
      ownerId: user.id,
      name: data.name,
      source: data.source,
      filterTree: data.filterTree as unknown as Prisma.InputJsonValue,
      scopeMode: data.scopeMode,
      scopeFilterTree:
        data.scopeFilterTree != null
          ? (data.scopeFilterTree as unknown as Prisma.InputJsonValue)
          : undefined,
      scopeRefKind: data.scopeRefKind ?? null,
      scopeRefId: data.scopeRefId ?? null,
      shared: data.shared,
    },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(
    {
      id: list.id,
      name: list.name,
      source: list.source,
      filterTree: list.filterTree,
      scopeMode: list.scopeMode,
      scopeFilterTree: list.scopeFilterTree,
      scopeRefKind: list.scopeRefKind,
      scopeRefId: list.scopeRefId,
      shared: list.shared,
      ownerId: list.ownerId,
      owner: list.owner
        ? { id: list.owner.id, fullName: list.owner.fullName, avatarUrl: list.owner.avatarUrl }
        : null,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
      hidden: false,
    },
    { status: 201 },
  );
}
