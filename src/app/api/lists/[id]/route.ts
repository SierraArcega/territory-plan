import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { updateListBodySchema } from "@/lib/saved-views/schema";
import { viewLayoutsSchema } from "@/lib/saved-views/grid-layout-schema";
import { Prisma } from "@prisma/client";

// Extend the base schema with viewLayouts — defined here to avoid a circular
// import (grid-layout-schema imports filterAndSchema from schema.ts).
const updateListBodyWithLayoutsSchema = updateListBodySchema.extend({
  viewLayouts: viewLayoutsSchema().optional(),
});

export const dynamic = "force-dynamic";

/**
 * GET /api/lists/[id]
 *
 * Returns a single SavedList. Visibility: owner OR shared. Per-user hide is
 * surfaced via the `hidden` field so the UI can show the hidden chip in the
 * portfolio view.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const list = await prisma.savedList.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      hidden: { where: { userId: user.id }, select: { hiddenAt: true } },
    },
  });

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  // Visibility: owner or shared
  if (list.ownerId !== user.id && !list.shared) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  return NextResponse.json({
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
    hidden: list.hidden.length > 0,
    // Column/sort/filter layout blob — null until the user first customises a view.
    viewLayouts: list.viewLayouts ?? null,
  });
}

/**
 * PATCH /api/lists/[id]
 *
 * Owner-only. Allows updating name, filterTree, scope*, and shared flag.
 * Source is immutable in v1 — changing source would require re-validating
 * the entire tree.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.savedList.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  if (existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateListBodyWithLayoutsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.scopeMode === "reference") {
    if (!data.scopeRefKind || !data.scopeRefId) {
      return NextResponse.json(
        { error: "scope mode 'reference' requires scopeRefKind and scopeRefId" },
        { status: 400 },
      );
    }
  }

  // Prisma's update treats `undefined` as "don't change". Build the data
  // object explicitly so a caller can clear a nullable column by passing
  // `null` (e.g. scopeRefId: null) without us losing it to undefined.
  const updateData: Prisma.SavedListUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.filterTree !== undefined) {
    updateData.filterTree = data.filterTree as unknown as Prisma.InputJsonValue;
  }
  if (data.scopeMode !== undefined) updateData.scopeMode = data.scopeMode;
  if (data.scopeFilterTree !== undefined) {
    updateData.scopeFilterTree =
      data.scopeFilterTree === null
        ? Prisma.JsonNull
        : (data.scopeFilterTree as unknown as Prisma.InputJsonValue);
  }
  if (data.scopeRefKind !== undefined) updateData.scopeRefKind = data.scopeRefKind;
  if (data.scopeRefId !== undefined) updateData.scopeRefId = data.scopeRefId;
  if (data.shared !== undefined) updateData.shared = data.shared;
  if (data.viewLayouts !== undefined) {
    updateData.viewLayouts =
      data.viewLayouts === null
        ? Prisma.JsonNull
        : (data.viewLayouts as unknown as Prisma.InputJsonValue);
  }

  const list = await prisma.savedList.update({
    where: { id },
    data: updateData,
    include: {
      owner: { select: { id: true, fullName: true, avatarUrl: true } },
      hidden: { where: { userId: user.id }, select: { hiddenAt: true } },
    },
  });

  return NextResponse.json({
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
    hidden: list.hidden.length > 0,
    // Column/sort/filter layout blob — null until the user first customises a view.
    viewLayouts: list.viewLayouts ?? null,
  });
}

/**
 * DELETE /api/lists/[id]
 *
 * Owner-only. Cascades to SavedListHidden via FK ON DELETE CASCADE.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.savedList.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  if (existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.savedList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
