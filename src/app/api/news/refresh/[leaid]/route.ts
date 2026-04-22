import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { ingestOneDistrict } from "@/features/news/lib/ingest";
import { matchArticles } from "@/features/news/lib/matcher";
import { classifyArticles } from "@/features/news/lib/classifier";

export const dynamic = "force-dynamic";

/**
 * In-memory rate limiter. Single-instance caveat: on multi-instance deploys
 * each instance has its own map. Acceptable for MVP — abuse is naturally
 * bounded by auth and typical UI flows.
 */
const lastRefreshedAt = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

/**
 * POST /api/news/refresh/[leaid]
 *
 * On-demand per-district refresh. Runs the Layer 3 Google News RSS query for
 * the named district synchronously, ingests results, runs matcher on new
 * articles, returns newArticles count for a toast.
 *
 * Rate-limited to 1 request per minute per leaid.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leaid } = await params;
  const now = Date.now();
  const last = lastRefreshedAt.get(leaid);
  if (last && now - last < RATE_LIMIT_MS) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: "Rate limited", retryAfter: retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }
  lastRefreshedAt.set(leaid, now);

  try {
    const ingestStats = await ingestOneDistrict(leaid);
    const matchStats = await matchArticles(ingestStats.newArticleIds);
    const classifyStats = await classifyArticles(ingestStats.newArticleIds, 4, 30_000);
    return NextResponse.json({
      newArticles: ingestStats.articlesNew,
      matched: matchStats.districtMatches,
      classified: classifyStats.classified,
      errors: ingestStats.errors.length + matchStats.errors.length + classifyStats.errors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Refresh failed", detail: String(err) },
      { status: 500 }
    );
  }
}
