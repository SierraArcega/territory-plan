// POST /api/reports/export — Runs a report query and returns CSV.
// Same body as /api/reports/query but without pagination (max 10,000 rows).

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { type FilterDef, buildWhereClause } from "@/features/explore/lib/filters";
import {
  ENTITY_FIELD_MAPS,
  ENTITY_PRISMA_MODEL,
  columnKeyToLabel,
} from "@/features/reports/lib/field-maps";

export const dynamic = "force-dynamic";

const MAX_EXPORT_ROWS = 10_000;

interface ExportBody {
  source: string;
  columns: string[];
  filters?: FilterDef[];
  sorts?: { column: string; direction: "asc" | "desc" }[];
  reportName?: string;
}

type PrismaDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ExportBody;
    const { source, columns, filters = [], sorts = [], reportName } = body;

    // Validate source
    const fieldMap = ENTITY_FIELD_MAPS[source];
    const prismaModel = ENTITY_PRISMA_MODEL[source];
    if (!fieldMap || !prismaModel) {
      return NextResponse.json(
        { error: `Unknown source: ${source}` },
        { status: 400 }
      );
    }

    // Validate columns
    const validColumns = columns.filter((col) => fieldMap[col]);
    if (validColumns.length === 0) {
      return NextResponse.json(
        { error: "No valid columns selected" },
        { status: 400 }
      );
    }

    // Build select
    const select: Record<string, boolean> = {};
    for (const col of validColumns) {
      const prismaField = fieldMap[col];
      if (prismaField) {
        select[prismaField] = true;
      }
    }

    // Build where clause
    const where = buildWhereClause(filters, fieldMap);

    // Build orderBy
    const orderBy: Record<string, string>[] = [];
    for (const sort of sorts) {
      const prismaField = fieldMap[sort.column];
      if (prismaField) {
        orderBy.push({ [prismaField]: sort.direction });
      }
    }

    // Access model dynamically
    const delegate = (prisma as unknown as Record<string, unknown>)[prismaModel] as PrismaDelegate;
    if (!delegate) {
      return NextResponse.json(
        { error: `Model not found: ${prismaModel}` },
        { status: 500 }
      );
    }

    // Fetch data (no pagination, but capped at MAX_EXPORT_ROWS)
    const rawData = (await delegate.findMany({
      select,
      where,
      orderBy: orderBy.length > 0 ? orderBy : undefined,
      take: MAX_EXPORT_ROWS,
    })) as Record<string, unknown>[];

    // Build reverse map
    const reverseMap: Record<string, string> = {};
    for (const col of validColumns) {
      const prismaField = fieldMap[col];
      if (prismaField) {
        reverseMap[prismaField] = col;
      }
    }

    // Build CSV
    const headers = validColumns.map((col) => columnKeyToLabel(col));
    const csvRows = [headers.join(",")];

    for (const row of rawData) {
      const values = validColumns.map((col) => {
        const prismaField = fieldMap[col];
        if (!prismaField) return "";
        const raw = row[prismaField];
        return escapeCsvValue(serializeValue(raw));
      });
      csvRows.push(values.join(","));
    }

    const csv = csvRows.join("\n");
    const filename = (reportName ?? "report").replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error("Report export error:", error);
    return NextResponse.json(
      { error: "Failed to export report" },
      { status: 500 }
    );
  }
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return value;
}

function escapeCsvValue(value: unknown): string {
  const str = String(value ?? "");
  // Quote if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
