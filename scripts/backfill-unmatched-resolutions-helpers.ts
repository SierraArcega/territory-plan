/**
 * Helpers for backfill-unmatched-resolutions.ts — separated for testability.
 *
 * namesMatch / normalizeDistrictName mirror scheduler/sync/district_resolver.py
 * byte-for-byte so the same conservative matching logic applies on both sides.
 */
import { Client } from "@opensearch-project/opensearch";

// ---------------------------------------------------------------------------
// Name normalisation — must stay in sync with:
//   scheduler/sync/district_resolver.py  (normalise_district_name / names_match)
//   prisma/migrations/manual/2026-04-13_normalize_district_name_fn.sql
// ---------------------------------------------------------------------------

// Multi-word phrases are listed first so they win over their component words,
// matching Python re's leftmost-longest semantics.
const SUFFIX_PATTERN =
  /\s*(unified school district|independent school district|consolidated school district|public school district|school district|schools|school|district|unified|public|elementary|junior|senior|high|middle|central|city|county|independent|charter|community|academy)\s*/gi;

const NON_ALNUM = /[^a-z0-9]+/g;

export function normalizeDistrictName(name: string | null | undefined): string {
  if (!name) return "";
  const stripped = name.toLowerCase().replace(SUFFIX_PATTERN, " ");
  return stripped.replace(NON_ALNUM, "");
}

export function namesMatch(
  oppName: string | null | undefined,
  districtName: string | null | undefined
): boolean {
  const a = normalizeDistrictName(oppName);
  const b = normalizeDistrictName(districtName);
  if (!a || !b) return true;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

// ---------------------------------------------------------------------------
// OpenSearch lookup
// ---------------------------------------------------------------------------

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const host = process.env.ELASTICSEARCH_HOST;
  if (!host) throw new Error("ELASTICSEARCH_HOST env var is required");
  _client = new Client({
    node: host,
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME!,
      password: process.env.ELASTICSEARCH_PASSWORD!,
    },
    ssl: { rejectUnauthorized: true },
  });
  return _client;
}

export interface DistrictHit {
  ncesId: string;
  name: string;
}

/**
 * Query OpenSearch `clj-prod-districts` for a district whose `id` field
 * equals `lmsId`. Returns null when:
 *  - no document is found
 *  - the document's ncesId is not exactly 7 digits (same rejection rule as
 *    scheduler/sync/queries.py:121)
 */
export async function lookupNcesByLmsId(
  lmsId: string
): Promise<DistrictHit | null> {
  const res = await getClient().search({
    index: "clj-prod-districts",
    body: {
      size: 1,
      query: { term: { id: lmsId } },
      _source: ["id", "ncesId", "name"],
    },
  });

  const hits = (res.body?.hits?.hits ?? []) as Array<{
    _source: { id: string; ncesId: string; name: string };
  }>;

  if (hits.length === 0) return null;

  const src = hits[0]._source;

  // Reject placeholder / test LEAID values — real NCES IDs are exactly 7 digits.
  if (!src.ncesId || src.ncesId.length !== 7 || !/^\d{7}$/.test(src.ncesId)) {
    return null;
  }

  return { ncesId: src.ncesId, name: src.name };
}
