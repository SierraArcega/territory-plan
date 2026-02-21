import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  UserGoal,
  GoalDashboard,
} from "@/features/shared/types/api-types";

// Create or update a user goal (upserts by fiscalYear)
export function useUpsertUserGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      fiscalYear: number;
      earningsTarget?: number | null;
      takeRatePercent?: number | null;
      renewalTarget?: number | null;
      winbackTarget?: number | null;
      expansionTarget?: number | null;
      newBusinessTarget?: number | null;
      takeTarget?: number | null;
      newDistrictsTarget?: number | null;
    }) =>
      fetchJson<UserGoal>(`${API_BASE}/profile/goals`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["goalDashboard"] });
    },
  });
}

// Delete a user goal
export function useDeleteUserGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fiscalYear: number) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/profile/goals/${fiscalYear}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// Goal Dashboard
export function useGoalDashboard(fiscalYear: number | null) {
  return useQuery({
    queryKey: ["goalDashboard", fiscalYear],
    queryFn: () =>
      fetchJson<GoalDashboard>(`${API_BASE}/profile/goals/${fiscalYear}/dashboard`),
    enabled: !!fiscalYear,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
