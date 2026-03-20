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

// ===== Outreach Action Hooks =====

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      to: string;
      subject: string;
      body: string;
      districtLeaid?: string;
      contactId?: number;
    }) =>
      fetchJson(`${API}/gmail/send`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useSendSlackMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      channelId: string;
      message: string;
      districtLeaid?: string;
    }) =>
      fetchJson(`${API}/slack/send`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useSlackChannels() {
  return useQuery<{ channels: Array<{ id: string; name: string }> }>({
    queryKey: ["slackChannels"],
    queryFn: () => fetchJson(`${API}/slack/channels`),
    staleTime: 5 * 60_000,
  });
}

export function useMixmaxCampaigns() {
  return useQuery<{
    sequences: Array<{ _id: string; name: string; numStages: number }>;
  }>({
    queryKey: ["mixmaxCampaigns"],
    queryFn: () => fetchJson(`${API}/mixmax/campaigns`),
    staleTime: 5 * 60_000,
  });
}

export function useAddToCampaign() {
  return useMutation({
    mutationFn: (data: { sequenceId: string; contactEmail: string }) =>
      fetchJson(`${API}/mixmax/campaigns`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
