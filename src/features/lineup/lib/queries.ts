import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { getToday } from "@/features/shared/lib/date-utils";

export interface LineSuggestion {
  activityType: string;
  title: string;
  districtLeaid: string | null;
  districtName: string | null;
  planId: string | null;
  planName: string | null;
  contractValue: number | null;
  lastContactDays: number | null;
  renewalWeeks: number | null;
  opportunityType: "renewal" | "expansion" | "winback" | "new_business";
  reasoning: string;
  goalTags: string[];
  riskTags: string[];
}

interface SuggestionsResponse {
  suggestions: LineSuggestion[];
}

// Returns today's rules-based suggestions, or null if the date isn't today.
export function useLineupSuggestions(date: string) {
  const isToday = date === getToday();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["lineup-suggestions", date],
    queryFn: () => fetchJson<SuggestionsResponse>(`${API_BASE}/lineup/suggestions`),
    enabled: isToday,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    suggestions: isToday ? (data?.suggestions ?? null) : null,
    isLoading: isToday ? isLoading : false,
    error: isToday ? error : null,
    refetch,
  };
}

// Records user interest in AI-powered suggestions (demand signal).
export function useSuggestionFeedback() {
  return useMutation({
    mutationFn: () =>
      fetchJson<void>(`${API_BASE}/lineup/suggestions/feedback`, { method: "POST" }),
  });
}
