import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { normalizeState } from "@/lib/states";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Fuzzy scoring helpers
// ---------------------------------------------------------------------------

/** Normalise a string for comparison: lowercase, strip common suffixes, split to words */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(
      /\b(school|schools|district|districts|public|unified|independent|isd|sd|usd|city|county|co|consolidated|cons|community|comm|area|regional|reg|township|twp|elementary|elem|high|middle|central|of|the|and|for)\b/g,
      "",
    )
    .split(/[\s\-\/,.()]+/)
    .filter((w) => w.length >= 2);
}

/** Score based on word overlap; returns { score, exactWordMatches } */
function overlapScore(
  a: string[],
  b: string[],
): { score: number; exactWordMatches: number } {
  if (a.length === 0 && b.length === 0) return { score: 0, exactWordMatches: 0 };
  const setB = new Set(b);
  let matches = 0;
  let exactWordMatches = 0;

  for (const word of a) {
    // exact match
    if (setB.has(word)) {
      matches += 1;
      exactWordMatches += 1;
      continue;
    }
    // prefix match (>=3 chars)
    if (word.length >= 3) {
      for (const bw of setB) {
        if (bw.startsWith(word) || word.startsWith(bw)) {
          matches += 0.7;
          break;
        }
      }
    }
  }

  // normalise against the smaller set so partial names still score well
  const denom = Math.min(a.length, b.length) || 1;
  return { score: matches / denom, exactWordMatches };
}

// ---------------------------------------------------------------------------
// GET /api/admin/districts/suggestions?name=...&state=...
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();
    const rawState = searchParams.get("state")?.trim();
    const state = rawState ? normalizeState(rawState) : undefined;

    if (!name || name.length < 2) {
      return NextResponse.json({ items: [] });
    }

    const nameTokens = tokenize(name);
    const seedWord = nameTokens[0];
    const hasState = state && state.length === 2;

    // Query same-state candidates first, then cross-state as fallback
    const selectFields = {
      leaid: true,
      name: true,
      stateAbbrev: true,
      enrollment: true,
      cityLocation: true,
    } as const;

    const queries = [];

    // Same-state candidates (primary pool)
    if (hasState && seedWord) {
      queries.push(
        prisma.district.findMany({
          where: {
            stateAbbrev: state,
            name: { contains: seedWord, mode: "insensitive" as const },
          },
          select: selectFields,
          take: 200,
        }),
      );
    }

    // Cross-state candidates (fallback pool, smaller)
    if (seedWord) {
      queries.push(
        prisma.district.findMany({
          where: {
            ...(hasState ? { stateAbbrev: { not: state } } : {}),
            name: { contains: seedWord, mode: "insensitive" as const },
          },
          select: selectFields,
          take: 100,
        }),
      );
    }

    const results = await Promise.all(queries);
    const candidates = results.flat();

    // Deduplicate by leaid
    const seen = new Set<string>();
    const unique = candidates.filter((d) => {
      if (seen.has(d.leaid)) return false;
      seen.add(d.leaid);
      return true;
    });

    // Score and rank — prioritize same-state districts with exact word matches
    const scored = unique
      .map((d) => {
        const { score, exactWordMatches } = overlapScore(nameTokens, tokenize(d.name));
        const sameState = hasState && d.stateAbbrev === state;
        // Ranking tiers: same-state + exact word match > same-state > cross-state
        const tier = sameState && exactWordMatches >= 1 ? 2 : sameState ? 1 : 0;
        return { ...d, score, exactWordMatches, tier };
      })
      .filter((d) => d.score > 0.3)
      .sort((a, b) => b.tier - a.tier || b.score - a.score)
      .slice(0, 8);

    // Strip internal fields from response
    const items = scored.map(
      ({ score: _s, exactWordMatches: _e, tier: _t, ...rest }) => rest,
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching district suggestions:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
