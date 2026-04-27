import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import { VALID_EXPENSE_CATEGORIES } from "@/features/activities/types";

export const dynamic = "force-dynamic";

// Owner-or-admin gate. POST is stricter than reads/notes/attachments because
// expenses materially shift the displayed reimbursement total — we don't want
// a teammate adding lines to someone else's activity.
async function assertCanWriteExpenses(activityId: string, userId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, createdByUserId: true },
  });
  if (!activity) return { error: "not_found" as const };
  if (activity.createdByUserId && activity.createdByUserId !== userId) {
    if (!(await isAdmin(userId))) return { error: "forbidden" as const };
  }
  return { activity };
}

function serializeExpense(e: {
  id: string;
  description: string;
  amount: { toString(): string } | number;
  category: string;
  incurredOn: Date;
  receiptStoragePath: string | null;
  createdById: string | null;
}) {
  const amountNum = Number(e.amount);
  return {
    id: e.id,
    description: e.description,
    amount: amountNum,
    amountCents: Math.round(amountNum * 100),
    category: e.category,
    incurredOn: e.incurredOn.toISOString(),
    receiptStoragePath: e.receiptStoragePath,
    createdById: e.createdById,
  };
}

// POST /api/activities/[id]/expenses
// Body: { category, description, amount, incurredOn, receiptStoragePath? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await assertCanWriteExpenses(id, user.id);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "not_found" ? 404 : 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  const amountRaw = body.amount;
  const category = typeof body.category === "string" ? body.category : "other";
  const incurredOnRaw = body.incurredOn;
  const receiptStoragePath =
    typeof body.receiptStoragePath === "string" ? body.receiptStoragePath : null;

  if (!description) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }
  if (!(VALID_EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_EXPENSE_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }
  const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }
  const incurredOn = incurredOnRaw ? new Date(incurredOnRaw) : new Date();
  if (isNaN(incurredOn.getTime())) {
    return NextResponse.json({ error: "incurredOn must be a valid date" }, { status: 400 });
  }

  const expense = await prisma.activityExpense.create({
    data: {
      activityId: id,
      description,
      amount,
      category,
      incurredOn,
      receiptStoragePath,
      createdById: user.id,
    },
  });

  return NextResponse.json(serializeExpense(expense));
}

// GET /api/activities/[id]/expenses — list all expenses on an activity.
// Read-permission mirrors the activity itself (owner, admin, or
// plan-collaborator). Kept separate from the activity detail GET so the
// drawer can refetch just expenses after a write without round-tripping
// the entire activity payload.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activity = await prisma.activity.findUnique({
    where: { id },
    select: { id: true, createdByUserId: true },
  });
  if (!activity) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (activity.createdByUserId && activity.createdByUserId !== user.id) {
    const linkedToPlan = await prisma.activityPlan.findFirst({
      where: { activityId: id },
      select: { planId: true },
    });
    if (!linkedToPlan && !(await isAdmin(user.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const expenses = await prisma.activityExpense.findMany({
    where: { activityId: id },
    orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    expenses: expenses.map(serializeExpense),
  });
}
