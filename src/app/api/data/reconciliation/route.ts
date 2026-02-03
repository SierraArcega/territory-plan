import { NextRequest, NextResponse } from "next/server";
import { Client } from "@opensearch-project/opensearch";

// OpenSearch client - lazy initialized
let osClient: Client | null = null;

function getOpenSearchClient(): Client {
  if (!osClient) {
    const host = process.env.ELASTICSEARCH_HOST;
    const username = process.env.ELASTICSEARCH_USERNAME;
    const password = process.env.ELASTICSEARCH_PASSWORD;

    if (!host || !username || !password) {
      throw new Error("OpenSearch credentials not configured");
    }

    osClient = new Client({
      node: host,
      auth: { username, password },
      ssl: { rejectUnauthorized: false },
    });
  }
  return osClient;
}

const OPPORTUNITIES_INDEX = process.env.OPENSEARCH_OPPORTUNITIES_INDEX || "clj-prod-opportunities";
const DISTRICTS_INDEX = process.env.OPENSEARCH_DISTRICTS_INDEX || "clj-prod-districts";

interface UnmatchedAccount {
  account_id: string;
  account_name: string;
  state: string | null;
  sales_exec: string | null;
  total_revenue: number;
  opportunity_count: number;
}

interface AccountVariant {
  name: string;
  source: "districts" | "opportunities";
  count: number;
}

interface FragmentedDistrict {
  nces_id: string;
  district_name: string | null;
  state: string | null;
  account_variants: AccountVariant[];
  similarity_score: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenSearchResponse = any;

async function getMatchedAccountIds(client: Client): Promise<Set<string>> {
  const query = {
    size: 0,
    query: {
      bool: {
        filter: [{ exists: { field: "ncesId" } }],
      },
    },
    aggs: {
      account_ids: {
        terms: { field: "_id", size: 50000 },
      },
    },
  };

  try {
    const response: OpenSearchResponse = await client.search({
      index: DISTRICTS_INDEX,
      body: query,
    });
    const buckets = response.body.aggregations?.account_ids?.buckets || [];
    return new Set(buckets.map((b: { key: string }) => b.key));
  } catch (error) {
    console.error("Error fetching matched account IDs:", error);
    return new Set();
  }
}

async function getUnmatchedAccounts(
  client: Client,
  state?: string | null,
  salesExec?: string | null,
  limit: number = 500
): Promise<UnmatchedAccount[]> {
  const matchedIds = await getMatchedAccountIds(client);
  console.log(`Found ${matchedIds.size} matched district accounts with ncesId`);

  const filters: object[] = [{ term: { "accounts.type.keyword": "district" } }];
  if (state) filters.push({ term: { "state.keyword": state } });
  if (salesExec) filters.push({ term: { "sales_rep.name.keyword": salesExec } });

  const query = {
    size: 0,
    query: { bool: { filter: filters } },
    aggs: {
      by_account: {
        terms: { field: "accounts.id", size: 10000 },
        aggs: {
          account_info: {
            top_hits: {
              size: 1,
              _source: ["accounts", "state", "sales_rep.name"],
            },
          },
          total_revenue: { sum: { field: "net_booking_amount" } },
          opp_count: { value_count: { field: "_id" } },
        },
      },
    },
  };

  const response: OpenSearchResponse = await client.search({
    index: OPPORTUNITIES_INDEX,
    body: query,
  });

  const buckets = response.body.aggregations?.by_account?.buckets || [];
  const results: UnmatchedAccount[] = [];

  for (const bucket of buckets) {
    const accountId = String(bucket.key);

    if (matchedIds.has(accountId)) continue;

    const hits = bucket.account_info?.hits?.hits || [];
    if (!hits.length) continue;

    const source = hits[0]._source;
    const accounts = source.accounts || [];
    const account = accounts.find((a: { id: number }) => String(a.id) === accountId) || {};

    results.push({
      account_id: accountId,
      account_name: account.name || "Unknown",
      state: source.state || null,
      sales_exec: source.sales_rep?.name || null,
      total_revenue: bucket.total_revenue?.value || 0,
      opportunity_count: Math.round(bucket.opp_count?.value || 0),
    });
  }

  results.sort((a, b) => b.total_revenue - a.total_revenue);
  return results.slice(0, limit);
}

async function getFragmentedAccounts(
  client: Client,
  state?: string | null,
  limit: number = 500
): Promise<FragmentedDistrict[]> {
  const districtFilters: object[] = [{ exists: { field: "ncesId" } }];
  if (state) districtFilters.push({ term: { "state.keyword": state } });

  const districtQuery = {
    size: 10000,
    query: { bool: { filter: districtFilters } },
    _source: ["ncesId", "name", "state", "id"],
  };

  const oppFilters: object[] = [{ term: { "accounts.type.keyword": "district" } }];
  if (state) oppFilters.push({ term: { "state.keyword": state } });

  const oppQuery = {
    size: 0,
    query: { bool: { filter: oppFilters } },
    aggs: {
      by_account: {
        terms: { field: "accounts.id", size: 10000 },
        aggs: {
          account_names: { terms: { field: "accounts.name.keyword", size: 10 } },
          opp_count: { value_count: { field: "_id" } },
        },
      },
    },
  };

  const [districtResponse, oppResponse]: OpenSearchResponse[] = await Promise.all([
    client.search({ index: DISTRICTS_INDEX, body: districtQuery }),
    client.search({ index: OPPORTUNITIES_INDEX, body: oppQuery }),
  ]);

  // Build district lookup by account ID
  const districtInfo: Map<string, { nces_id: string; name: string; state: string | null }> = new Map();
  for (const hit of districtResponse.body.hits?.hits || []) {
    const accountId = hit._id;
    const source = hit._source;
    districtInfo.set(accountId, {
      nces_id: source.ncesId,
      name: source.name,
      state: source.state || null,
    });
  }

  // Build opportunity account names lookup
  const oppAccounts: Map<string, { name: string; count: number }[]> = new Map();
  for (const bucket of oppResponse.body.aggregations?.by_account?.buckets || []) {
    const accountId = String(bucket.key);
    const names = (bucket.account_names?.buckets || []).map((b: { key: string; doc_count: number }) => ({
      name: b.key,
      count: b.doc_count,
    }));
    oppAccounts.set(accountId, names);
  }

  // Compare and find fragmented accounts
  const results: FragmentedDistrict[] = [];
  for (const [accountId, info] of districtInfo) {
    const oppNames = oppAccounts.get(accountId) || [];
    if (!oppNames.length) continue;

    const allNames = new Set<string>();
    if (info.name) allNames.add(info.name);
    for (const item of oppNames) allNames.add(item.name);

    if (allNames.size > 1) {
      const variants: AccountVariant[] = [];

      if (info.name) {
        variants.push({ name: info.name, source: "districts", count: 1 });
      }

      for (const item of oppNames) {
        if (item.name !== info.name) {
          variants.push({ name: item.name, source: "opportunities", count: item.count });
        }
      }

      results.push({
        nces_id: info.nces_id,
        district_name: info.name || null,
        state: info.state,
        account_variants: variants,
        similarity_score: Math.round((1 / allNames.size) * 100) / 100,
      });
    }
  }

  results.sort((a, b) => a.similarity_score - b.similarity_score);
  return results.slice(0, limit);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const state = searchParams.get("state");
  const salesExec = searchParams.get("salesExec");
  const limit = parseInt(searchParams.get("limit") || "500", 10);

  if (!type || !["unmatched", "fragmented"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid type. Must be 'unmatched' or 'fragmented'" },
      { status: 400 }
    );
  }

  try {
    const client = getOpenSearchClient();

    if (type === "unmatched") {
      const data = await getUnmatchedAccounts(client, state, salesExec, limit);
      return NextResponse.json(data);
    } else {
      const data = await getFragmentedAccounts(client, state, limit);
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Error querying OpenSearch:", error);
    return NextResponse.json(
      { error: "Failed to fetch reconciliation data" },
      { status: 503 }
    );
  }
}
