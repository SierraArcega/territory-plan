import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { abbrevToFips } from "@/lib/states";

const MAX_LIMIT = 50;

interface Cursor { capturedDate: string; id: number }

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(s: string): Cursor | null {
  try {
    const obj = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    if (typeof obj.capturedDate === "string" && typeof obj.id === "number") return obj;
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const leaid = sp.get("leaid");
  const stateFipsArg = sp.get("stateFips");
  const stateArg = sp.get("state");
  const q = sp.get("q");
  const cursorStr = sp.get("cursor");
  const limitArg = Number(sp.get("limit") ?? MAX_LIMIT);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(limitArg) ? limitArg : MAX_LIMIT));

  const where: Record<string, unknown> = {};
  if (leaid) where.leaid = leaid;
  if (stateFipsArg) where.stateFips = stateFipsArg;
  else if (stateArg) {
    const fips = abbrevToFips(stateArg);
    if (fips) where.stateFips = fips;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { agencyName: { contains: q, mode: "insensitive" } },
    ];
  }

  if (cursorStr) {
    const cursor = decodeCursor(cursorStr);
    if (cursor) {
      const cap = new Date(cursor.capturedDate);
      const cursorOR = [
        { capturedDate: { lt: cap } },
        { capturedDate: cap, id: { lt: cursor.id } },
      ];
      if (where.OR) {
        // Combine existing q-based OR with cursor clause using AND
        where.AND = [{ OR: where.OR }, { OR: cursorOR }];
        delete where.OR;
      } else {
        where.OR = cursorOR;
      }
    }
  }

  const rows = await prisma.rfp.findMany({
    where,
    orderBy: [{ capturedDate: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last
    ? encodeCursor({ capturedDate: last.capturedDate.toISOString(), id: last.id })
    : null;

  return NextResponse.json({ items, nextCursor });
}
