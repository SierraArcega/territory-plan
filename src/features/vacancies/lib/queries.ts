import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

// ---------- Types ----------

export interface Vacancy {
  id: string;
  leaid: string;
  title: string;
  schoolName: string | null;
  category: string | null;
  fullmindRelevant: boolean;
  matchedServiceLine: string | null;
  hiringManager: string | null;
  hiringEmail: string | null;
  datePosted: string | null;
  sourceUrl: string | null;
  fingerprint: string;
  createdAt: string;
}

interface VacanciesResponse {
  vacancies: Vacancy[];
}

/** Shape returned by the plan-level vacancies endpoint */
export interface PlanVacancyItem {
  id: string;
  title: string;
  category: string | null;
  status: string;
  districtName: string;
  districtLeaid: string;
  schoolName: string | null;
  hiringManager: string | null;
  hiringEmail: string | null;
  startDate: string | null;
  datePosted: string | null;
  daysOpen: number | null;
  fullmindRelevant: boolean;
  relevanceReason: string | null;
  sourceUrl: string | null;
}

export interface PlanVacanciesSummary {
  total: number;
  fullmindRelevant: number;
  byCategory: Record<string, number>;
  byDistrict: Record<string, number>;
}

export interface PlanVacanciesResponse {
  vacancies: PlanVacancyItem[];
  summary: PlanVacanciesSummary;
}

interface ScanDistrictResponse {
  scanId: string;
  status: "pending";
}

interface BulkScanResponse {
  batchId: string;
  totalDistricts: number;
  scansCreated: number;
  skipped: number;
}

export interface BatchProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  pending: number;
  vacanciesFound: number;
  fullmindRelevant: number;
}

// ---------- Query Hooks ----------

/** Fetch vacancies for a district */
export function useVacancies(leaid: string | null) {
  return useQuery({
    queryKey: ["vacancies", leaid],
    queryFn: () =>
      fetchJson<VacanciesResponse>(
        `${API_BASE}/districts/${encodeURIComponent(leaid!)}/vacancies`
      ),
    enabled: !!leaid,
    staleTime: 5 * 60 * 1000, // 5 minutes — vacancy data doesn't change rapidly
  });
}

/** Trigger a vacancy scan for a single district */
export function useScanDistrict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaid: string) =>
      fetchJson<ScanDistrictResponse>(`${API_BASE}/vacancies/scan`, {
        method: "POST",
        body: JSON.stringify({ leaid }),
      }),
    onSuccess: (_data, leaid) => {
      // Invalidate vacancies for this district so the list refreshes after scan completes
      queryClient.invalidateQueries({ queryKey: ["vacancies", leaid] });
    },
  });
}

/** Trigger a bulk scan for all districts in a territory plan */
export function useBulkScan() {
  return useMutation({
    mutationFn: (territoryPlanId: string) =>
      fetchJson<BulkScanResponse>(`${API_BASE}/vacancies/scan-bulk`, {
        method: "POST",
        body: JSON.stringify({ territoryPlanId }),
      }),
  });
}

/** Fetch all vacancies across districts in a territory plan */
export function usePlanVacancies(planId: string | null) {
  return useQuery({
    queryKey: ["planVacancies", planId],
    queryFn: () =>
      fetchJson<PlanVacanciesResponse>(
        `${API_BASE}/territory-plans/${encodeURIComponent(planId!)}/vacancies`
      ),
    enabled: !!planId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/** Poll batch progress for a bulk scan */
export function useBatchProgress(batchId: string | null) {
  return useQuery({
    queryKey: ["vacancyBatch", batchId],
    queryFn: () =>
      fetchJson<BatchProgress>(
        `${API_BASE}/vacancies/batch/${encodeURIComponent(batchId!)}`
      ),
    enabled: !!batchId,
    refetchInterval: (query) => {
      // Stop polling once all scans are done (pending === 0)
      const data = query.state.data;
      if (data && data.pending === 0) return false;
      return 2000; // Poll every 2 seconds while scans are in progress
    },
    staleTime: 0, // Always fetch fresh data when polling
  });
}
