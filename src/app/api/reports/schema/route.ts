// GET /api/reports/schema — Returns available entities and their columns for the Report Builder.
// Reads from static field maps (no runtime introspection).

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  ENTITY_FIELD_MAPS,
  ENTITY_LABELS,
  ENTITY_COLUMN_META,
  columnKeyToLabel,
} from "@/features/reports/lib/field-maps";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entities = Object.entries(ENTITY_FIELD_MAPS).map(([name, fieldMap]) => {
      const columnMeta = ENTITY_COLUMN_META[name] ?? {};
      const columns = Object.keys(fieldMap).map((key) => ({
        key,
        label: columnKeyToLabel(key),
        type: columnMeta[key]?.type ?? "string",
      }));

      return {
        name,
        label: ENTITY_LABELS[name] ?? name,
        columns,
      };
    });

    return NextResponse.json({ entities });
  } catch (error) {
    console.error("Error fetching report schema:", error);
    return NextResponse.json(
      { error: "Failed to fetch report schema" },
      { status: 500 }
    );
  }
}
