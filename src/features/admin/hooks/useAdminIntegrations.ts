import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

export interface AdminIntegration {
  name: string;
  slug: string;
  status: string;
  connectedUsers: number | null;
  totalUsers: number | null;
  lastSyncAt: string | null;
  description: string;
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
