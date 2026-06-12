import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

export interface AdminIntegration {
  name: string;
  slug: string;
  status: string;
  connectedUsers: number | null;
  totalUsers: number | null;
  lastSyncAt: string | null;
  description: string;
  modeChangedAt?: string | null;
  modeChangedByName?: string | null;
}

interface AdminIntegrationsResponse {
  integrations: AdminIntegration[];
}

export function useAdminIntegrations() {
  return useQuery({
    queryKey: ["admin", "integrations"],
    queryFn: () =>
      fetchJson<AdminIntegrationsResponse>(
        `${API_BASE}/admin/integrations`
      ),
    staleTime: 2 * 60 * 1000,
  });
}

export function useUpdateAppSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      fetchJson<{ key: string; value: boolean }>(`${API_BASE}/admin/settings`, {
        method: "PATCH",
        body: JSON.stringify({ key, value }),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] }),
  });
}
