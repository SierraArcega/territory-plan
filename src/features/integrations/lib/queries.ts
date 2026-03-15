import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/features/shared/lib/api-client";
import type { IntegrationConnection, IntegrationService } from "../types";

const API = "/api/integrations";

export function useIntegrations() {
  return useQuery<IntegrationConnection[]>({
    queryKey: ["integrations"],
    queryFn: () => fetchJson(API),
    staleTime: 5 * 60_000, // 5 min
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (service: IntegrationService) =>
      fetchJson(`${API}/${service}/disconnect`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}

export function useConnectMixmax() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) =>
      fetchJson(`${API}/mixmax/connect`, {
        method: "POST",
        body: JSON.stringify({ apiKey }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}
