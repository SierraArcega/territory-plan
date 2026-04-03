import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/features/shared/lib/api-client";
import type {
  EngageTemplate,
  SequenceData,
  SequenceExecutionData,
  StepExecutionData,
  SequenceStepData,
} from "../types";

const API = "/api/engage";

// ===== Templates =====

export function useEngageTemplates(type?: string) {
  const params = type ? `?type=${encodeURIComponent(type)}` : "";
  return useQuery<EngageTemplate[]>({
    queryKey: ["engage-templates", type],
    queryFn: () => fetchJson(`${API}/templates${params}`),
    staleTime: 2 * 60_000, // 2 min
  });
}

export function useEngageTemplate(id: number | null) {
  return useQuery<EngageTemplate>({
    queryKey: ["engage-template", id],
    queryFn: () => fetchJson(`${API}/templates/${id}`),
    enabled: id !== null,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<EngageTemplate, "id" | "createdByUserId" | "isArchived" | "createdAt" | "updatedAt">) =>
      fetchJson<EngageTemplate>(`${API}/templates`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engage-templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Pick<EngageTemplate, "name" | "type" | "subject" | "body">>) =>
      fetchJson<EngageTemplate>(`${API}/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-templates"] });
      queryClient.invalidateQueries({ queryKey: ["engage-template", variables.id] });
    },
  });
}

export function useArchiveTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<{ success: boolean }>(`${API}/templates/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engage-templates"] });
    },
  });
}

// ===== Sequences =====

export function useSequences() {
  return useQuery<SequenceData[]>({
    queryKey: ["engage-sequences"],
    queryFn: () => fetchJson(`${API}/sequences`),
  });
}

export function useSequence(id: number | null) {
  return useQuery<SequenceData>({
    queryKey: ["engage-sequence", id],
    queryFn: () => fetchJson(`${API}/sequences/${id}`),
    enabled: id !== null,
  });
}

export function useCreateSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string | null }) =>
      fetchJson<SequenceData>(`${API}/sequences`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engage-sequences"] });
    },
  });
}

export function useUpdateSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; description?: string | null; isArchived?: boolean }) =>
      fetchJson<SequenceData>(`${API}/sequences/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-sequences"] });
      queryClient.invalidateQueries({ queryKey: ["engage-sequence", variables.id] });
    },
  });
}

// ===== Steps =====

export function useAddStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sequenceId,
      ...data
    }: {
      sequenceId: number;
      templateId?: number | null;
      type: string;
      subject?: string | null;
      body?: string | null;
      delayDays?: number;
    }) =>
      fetchJson<SequenceStepData>(`${API}/sequences/${sequenceId}/steps`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-sequence", variables.sequenceId] });
      queryClient.invalidateQueries({ queryKey: ["engage-sequences"] });
    },
  });
}

export function useReorderSteps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, stepIds }: { sequenceId: number; stepIds: number[] }) =>
      fetchJson<{ success: boolean }>(`${API}/sequences/${sequenceId}/steps`, {
        method: "PATCH",
        body: JSON.stringify({ stepIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-sequence", variables.sequenceId] });
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sequenceId,
      stepId,
      ...data
    }: {
      sequenceId: number;
      stepId: number;
      templateId?: number | null;
      type?: string;
      subject?: string | null;
      body?: string | null;
      delayDays?: number;
    }) =>
      fetchJson<SequenceStepData>(`${API}/sequences/${sequenceId}/steps/${stepId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-sequence", variables.sequenceId] });
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, stepId }: { sequenceId: number; stepId: number }) =>
      fetchJson<{ success: boolean }>(`${API}/sequences/${sequenceId}/steps/${stepId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-sequence", variables.sequenceId] });
      queryClient.invalidateQueries({ queryKey: ["engage-sequences"] });
    },
  });
}

// ===== Executions =====

export function useExecutions(status?: string) {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  return useQuery<SequenceExecutionData[]>({
    queryKey: ["engage-executions", status],
    queryFn: () => fetchJson(`${API}/executions${params}`),
    staleTime: 30_000, // 30s
  });
}

export function useExecution(id: number | null) {
  return useQuery<SequenceExecutionData & { stepExecutions: StepExecutionData[] }>({
    queryKey: ["engage-execution", id],
    queryFn: () => fetchJson(`${API}/executions/${id}`),
    enabled: id !== null,
    staleTime: 10_000, // 10s
  });
}

export function useLaunchExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sequenceId,
      ...data
    }: {
      sequenceId: number;
      contactIds: number[];
      customFields?: Record<number, Record<string, string>>;
    }) =>
      fetchJson<SequenceExecutionData>(`${API}/sequences/${sequenceId}/execute`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engage-executions"] });
    },
  });
}

export function useSendStepEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      executionId,
      ...data
    }: {
      executionId: number;
      stepExecutionId: number;
      subject: string;
      body: string;
    }) =>
      fetchJson<StepExecutionData>(`${API}/executions/${executionId}/send`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-execution", variables.executionId] });
      queryClient.invalidateQueries({ queryKey: ["engage-executions"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useCompleteStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      executionId,
      ...data
    }: {
      executionId: number;
      stepExecutionId: number;
      notes?: string;
    }) =>
      fetchJson<StepExecutionData>(`${API}/executions/${executionId}/complete`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-execution", variables.executionId] });
      queryClient.invalidateQueries({ queryKey: ["engage-executions"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useSkipStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      executionId,
      ...data
    }: {
      executionId: number;
      stepExecutionId: number;
      notes?: string;
    }) =>
      fetchJson<StepExecutionData>(`${API}/executions/${executionId}/skip`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-execution", variables.executionId] });
      queryClient.invalidateQueries({ queryKey: ["engage-executions"] });
    },
  });
}

export function useUpdateExecutionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, status }: { executionId: number; status: string }) =>
      fetchJson<SequenceExecutionData>(`${API}/executions/${executionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["engage-execution", variables.executionId] });
      queryClient.invalidateQueries({ queryKey: ["engage-executions"] });
    },
  });
}
