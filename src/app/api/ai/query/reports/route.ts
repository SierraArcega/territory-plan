import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { validateParams } from "@/features/reports/lib/params-validator";
import type { QueryParams } from "@/features/reports/lib/types";

export const dynamic = "force-dynamic";

type Tab = "all" | "mine" | "team" | "pinned";

function parseTab(raw: string | null): Tab {
  if (raw === "mine" || raw === "team" || raw === "pinned") return raw;
  return "all";
}

function parseSort(raw: string | null): "recent" | "name" {
  return raw === "name" ? "name" : "recent";
}

// GET /api/ai/query/reports?tab=<all|mine|team|pinned>&search=<q>&sort=<recent|name>
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tab = parseTab(url.searchParams.get("tab"));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const sort = parseSort(url.searchParams.get("sort"));

  const where: Prisma.SavedReportWhereInput = {};
  if (tab === "mine") where.userId = user.id;
  if (tab === "team" || tab === "pinned") where.isTeamPinned = true;
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }

  const reports = await prisma.savedReport.findMany({
    where,
    orderBy:
      sort === "name"
        ? { title: "asc" }
        : [{ lastRunAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    include: {
      user: { select: { id: true, fullName: true, avatarUrl: true } },
    },
    take: 200,
  });

  return NextResponse.json({ reports });
}

interface CreateReportBody {
  title?: string;
  description?: string;
  params?: QueryParams;
  question?: string;
  conversationId?: string;
}

// POST /api/ai/query/reports
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateReportBody;
  try {
    body = (await request.json()) as CreateReportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.params) {
    return NextResponse.json({ error: "Missing 'params'" }, { status: 400 });
  }

  const validation = validateParams(body.params);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid params", details: validation.errors },
      { status: 400 },
    );
  }

  const report = await prisma.savedReport.create({
    data: {
      userId: user.id,
      title,
      question: body.question ?? title,
      params: validation.normalized as unknown as object,
      sql: null,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
