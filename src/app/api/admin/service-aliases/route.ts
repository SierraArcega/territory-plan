import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/service-aliases — list existing alias mappings.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const aliases = await prisma.serviceAlias.findMany({
    orderBy: { alias: "asc" },
    include: { service: { select: { id: true, name: true, slug: true } } },
  });
  return NextResponse.json({ aliases });
}

// POST /api/admin/service-aliases — create or update a mapping.
// Body: { alias: string, serviceId?: number | null, ignored?: boolean }
// Either serviceId or ignored=true must be set; not both.
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { alias, serviceId, ignored } = body as {
    alias?: unknown;
    serviceId?: unknown;
    ignored?: unknown;
  };

  if (typeof alias !== "string" || alias.trim().length === 0) {
    return NextResponse.json({ error: "alias is required" }, { status: 400 });
  }

  const ignoredBool = ignored === true;
  const serviceIdNum =
    typeof serviceId === "number" ? serviceId : serviceId == null ? null : NaN;

  if (Number.isNaN(serviceIdNum)) {
    return NextResponse.json({ error: "serviceId must be a number or null" }, { status: 400 });
  }

  if (ignoredBool && serviceIdNum != null) {
    return NextResponse.json(
      { error: "Cannot set both serviceId and ignored=true" },
      { status: 400 }
    );
  }

  if (!ignoredBool && serviceIdNum == null) {
    return NextResponse.json(
      { error: "Must set either serviceId or ignored=true" },
      { status: 400 }
    );
  }

  if (serviceIdNum != null) {
    const exists = await prisma.service.findUnique({ where: { id: serviceIdNum } });
    if (!exists) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const row = await prisma.serviceAlias.upsert({
    where: { alias: alias.trim() },
    update: { serviceId: serviceIdNum, ignored: ignoredBool },
    create: { alias: alias.trim(), serviceId: serviceIdNum, ignored: ignoredBool },
  });

  return NextResponse.json({ alias: row });
}
