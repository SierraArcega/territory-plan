// POST /api/reports/query — Executes a report query with dynamic source, columns, filters, sorts, and pagination.
// Uses the same buildWhereClause pattern as the explore API.

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { type FilterDef, buildWhereClause } from "@/features/explore/lib/filters";
import {
  ENTITY_FIELD_MAPS,
  ENTITY_PRISMA_MODEL,
} from "@/features/reports/lib/field-maps";

export const dynamic = "force-dynamic";

interface QueryBody {
  source: string;
  columns: string[];
  filters?: FilterDef[];
  sorts?: { column: string; direction: "asc" | "desc" }[];
  page?: number;
  pageSize?: number;
}

// Prisma model accessor type — we need to access prisma[modelName] dynamically
type PrismaDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as QueryBody;
    const { source, columns, filters = [], sorts = [] } = body;
    const page = Math.max(1, body.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, body.pageSize ?? 50));

    // Validate source
    const fieldMap = ENTITY_FIELD_MAPS[source];
    const prismaModel = ENTITY_PRISMA_MODEL[source];
    if (!fieldMap || !prismaModel) {
      return NextResponse.json(
        { error: `Unknown source: ${source}` },
        { status: 400 }
      );
    }

    // Validate columns — only allow columns in the field map
    const validColumns = columns.filter((col) => fieldMap[col]);
    if (validColumns.length === 0) {
      return NextResponse.json(
        { error: "No valid columns selected" },
        { status: 400 }
      );
    }

    // Build select — only fetch requested columns
    const select: Record<string, boolean> = {};
    for (const col of validColumns) {
      const prismaField = fieldMap[col];
      if (prismaField) {
        select[prismaField] = true;
      }
    }

    // Build where clause from filters
    const where = buildWhereClause(filters, fieldMap);

    // Build orderBy from sorts
    const orderBy: Record<string, string>[] = [];
    for (const sort of sorts) {
      const prismaField = fieldMap[sort.column];
      if (prismaField) {
        orderBy.push({ [prismaField]: sort.direction });
      }
    }

    // Access the Prisma model dynamically
    const delegate = (prisma as Record<string, unknown>)[prismaModel] as PrismaDelegate;
    if (!delegate) {
      return NextResponse.json(
        { error: `Model not found: ${prismaModel}` },
        { status: 500 }
      );
    }

    // Run query and count in parallel
    const [rawData, total] = await Promise.all([
      delegate.findMany({
        select,
        where,
        orderBy: orderBy.length > 0 ? orderBy : undefined,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      delegate.count({ where }),
    ]);

    // Build reverse map: Prisma field → client key
    const reverseMap: Record<string, string> = {};
    for (const col of validColumns) {
      const prismaField = fieldMap[col];
      if (prismaField) {
        reverseMap[prismaField] = col;
      }
    }

    // Reshape data: convert Prisma field names back to client keys,
    // and handle Decimal/Date serialization
    const data = (rawData as Record<string, unknown>[]).map((row) => {
      const shaped: Record<string, unknown> = {};
      for (const [prismaField, value] of Object.entries(row)) {
        const clientKey = reverseMap[prismaField] ?? prismaField;
        shaped[clientKey] = serializeValue(value);
      }
      return shaped;
    });

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total },
    });
  } catch (error) {
    console.error("Report query error:", error);

    // Handle Prisma validation errors
    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to execute report query" },
      { status: 500 }
    );
  }
}

/** Convert Prisma types to JSON-safe values */
function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  // Prisma Decimal — has a toNumber() method
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return value;
}
