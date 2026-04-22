import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

export interface NewsArticleDto {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  author: string | null;
  source: string;
  feedSource: string;
  publishedAt: string;
  confidence?: string;
  districtLeaid?: string;
  districtName?: string;
}

interface NewsListResponse {
  articles: NewsArticleDto[];
}

interface RefreshResponse {
  newArticles: number;
  matched: number;
  errors: number;
}

const DEFAULT_LIMIT = 5;

const qk = {
  district: (leaid: string, limit: number) => ["news", "district", leaid, limit] as const,
  school: (ncessch: string, limit: number) => ["news", "school", ncessch, limit] as const,
  contact: (contactId: number) => ["news", "contact", contactId] as const,
  territory: (planId: string, limit: number) => ["news", "territory", planId, limit] as const,
  myTerritory: (limit: number) => ["news", "my-territory", limit] as const,
};

export function useDistrictNewsQuery(leaid: string | null, limit = DEFAULT_LIMIT) {
  return useQuery({
    queryKey: qk.district(leaid ?? "", limit),
    queryFn: async () =>
      fetchJson<NewsListResponse>(
        `${API_BASE}/api/news?leaid=${encodeURIComponent(leaid!)}&limit=${limit}`
      ),
    enabled: Boolean(leaid),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSchoolNewsQuery(ncessch: string | null, limit = DEFAULT_LIMIT) {
  return useQuery({
    queryKey: qk.school(ncessch ?? "", limit),
    queryFn: async () =>
      fetchJson<NewsListResponse>(
        `${API_BASE}/api/news?ncessch=${encodeURIComponent(ncessch!)}&limit=${limit}`
      ),
    enabled: Boolean(ncessch),
    staleTime: 10 * 60 * 1000,
  });
}

export function useContactNewsQuery(contactId: number | null) {
  return useQuery({
    queryKey: qk.contact(contactId ?? 0),
    queryFn: async () =>
      fetchJson<NewsListResponse>(`${API_BASE}/api/news?contactId=${contactId}&limit=3`),
    enabled: contactId !== null && contactId > 0,
    staleTime: 10 * 60 * 1000,
  });
}

export function useTerritoryNewsQuery(territoryPlanId: string | null, limit = 10) {
  return useQuery({
    queryKey: qk.territory(territoryPlanId ?? "", limit),
    queryFn: async () =>
      fetchJson<NewsListResponse>(
        `${API_BASE}/api/news?territoryPlanId=${encodeURIComponent(territoryPlanId!)}&limit=${limit}`
      ),
    enabled: Boolean(territoryPlanId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyTerritoryNewsQuery(limit = 10) {
  return useQuery({
    queryKey: qk.myTerritory(limit),
    queryFn: async () =>
      fetchJson<NewsListResponse>(
        `${API_BASE}/api/news?scope=my-territory&limit=${limit}`
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshDistrictNewsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leaid: string) =>
      fetchJson<RefreshResponse>(`${API_BASE}/api/news/refresh/${leaid}`, {
        method: "POST",
      }),
    onSuccess: (_data, leaid) => {
      qc.invalidateQueries({ queryKey: ["news", "district", leaid] });
      qc.invalidateQueries({ queryKey: ["news", "my-territory"] });
    },
  });
}
