import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/activities/[id]/expenses/[expenseId]
// Owner-or-admin only — same gate as POST.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  const { id, expenseId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activity = await prisma.activity.findUnique({
    where: { id },
    select: { id: true, createdByUserId: true },
  });
  if (!activity) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (activity.createdByUserId && activity.createdByUserId !== user.id) {
    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // Confirm the expense actually belongs to this activity before deleting,
  // so a stale UI passing an unrelated expenseId can't blow away a row on a
  // different activity.
  const expense = await prisma.activityExpense.findUnique({
    where: { id: expenseId },
    select: { id: true, activityId: true },
  });
  if (!expense || expense.activityId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.activityExpense.delete({ where: { id: expenseId } });
  return NextResponse.json({ success: true });
}
