import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readonlyPool } from "@/lib/db-readonly";
import { getUser } from "@/lib/supabase/server";
import { US_STATES, STATE_ABBREV_TO_NAME } from "@/lib/states";

export const dynamic = "force-dynamic";

const VALID_SOURCES = [
  "states",
  "users",
  "stages",
  "personas",
  "seniorities",
  "feed_sources",
  "contract_types",
] as const;
type EnumSourceId = (typeof VALID_SOURCES)[number];

function isValidSource(s: string | null): s is EnumSourceId {
  return VALID_SOURCES.includes(s as EnumSourceId);
}

// Hardcoded mapping — table/column values come ONLY from this map, never from user input.
const DISTINCT_CONFIGS: Record<
  "personas" | "seniorities" | "feed_sources",
  { table: string; column: string }
> = {
  personas: { table: "contacts", column: "persona" },
  seniorities: { table: "contacts", column: "seniority_level" },
  feed_sources: { table: "news_articles", column: "feed_source" },
};

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = new URL(req.url).searchParams.get("source");
  if (!isValidSource(source)) {
    return NextResponse.json(
      { error: `Unknown source "${source ?? ""}"` },
      { status: 400 },
    );
  }

  switch (source) {
    case "states": {
      const values = US_STATES.map((abbrev) => ({
        value: abbrev,
        label: STATE_ABBREV_TO_NAME[abbrev] ?? abbrev,
      }));
      return NextResponse.json({ values });
    }

    case "users": {
      const users = await prisma.userProfile.findMany({
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: "asc" },
      });
      return NextResponse.json({
        values: users.map((u) => ({
          value: u.id,
          label: u.fullName ?? u.email ?? u.id,
        })),
      });
    }

    case "stages": {
      const result = await readonlyPool.query<{ stage: string }>(
        `SELECT DISTINCT stage FROM opportunities WHERE stage IS NOT NULL ORDER BY stage`,
      );
      return NextResponse.json({
        values: result.rows.map((r) => ({ value: r.stage, label: r.stage })),
      });
    }

    case "contract_types": {
      const result = await readonlyPool.query<{ contract_type: string }>(
        `SELECT DISTINCT contract_type FROM opportunities WHERE contract_type IS NOT NULL ORDER BY contract_type`,
      );
      return NextResponse.json({
        values: result.rows.map((r) => ({
          value: r.contract_type,
          label: r.contract_type,
        })),
      });
    }

    case "personas":
    case "seniorities":
    case "feed_sources": {
      // config values come only from the hardcoded DISTINCT_CONFIGS map above.
      const config = DISTINCT_CONFIGS[source];
      const result = await readonlyPool.query<{ v: string }>(
        `SELECT DISTINCT "${config.column}" AS v FROM "${config.table}"
         WHERE "${config.column}" IS NOT NULL ORDER BY "${config.column}"`,
      );
      return NextResponse.json({
        values: result.rows.map((r) => ({ value: r.v, label: r.v })),
      });
    }
  }
}
