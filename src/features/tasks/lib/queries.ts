import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { TaskStatus, TaskPriority } from "@/features/tasks/types";
import type {
  TasksParams,
  TasksResponse,
  TaskItem,
} from "@/features/shared/types/api-types";

// List tasks with filtering
export function useTasks(params: TasksParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.priority) searchParams.set("priority", params.priority);
  if (params.planId) searchParams.set("planId", params.planId);
  if (params.activityId) searchParams.set("activityId", params.activityId);
  if (params.leaid) searchParams.set("leaid", params.leaid);
  if (params.contactId) searchParams.set("contactId", params.contactId);
  if (params.search) searchParams.set("search", params.search);
  if (params.dueBefore) searchParams.set("dueBefore", params.dueBefore);
  if (params.dueAfter) searchParams.set("dueAfter", params.dueAfter);

  const queryString = searchParams.toString();
  const url = `${API_BASE}/tasks${queryString ? `?${queryString}` : ""}`;

  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => fetchJson<TasksResponse>(url),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fetch single task detail
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => fetchJson<TaskItem>(`${API_BASE}/tasks/${taskId}`),
    enabled: !!taskId,
    staleTime: 2 * 60 * 1000,
  });
}

// Create task
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string | null;
      position?: number;
      planIds?: string[];
      activityIds?: string[];
      leaids?: string[];
      contactIds?: number[];
    }) =>
      fetchJson<TaskItem>(`${API_BASE}/tasks`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Update task fields
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      ...data
    }: {
      taskId: string;
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string | null;
      position?: number;
    }) =>
      fetchJson<TaskItem>(`${API_BASE}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Delete task
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Reorder tasks (batch update status + position for drag-and-drop)
// Uses optimistic updates so the kanban board feels instant
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: { taskId: string; status: string; position: number }[]) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/tasks/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      }),
    // Optimistic update: immediately reflect the new order in the cache
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      // Snapshot current cache for rollback
      const previousQueries = queryClient.getQueriesData({ queryKey: ["tasks"] });

      // Update all matching task caches optimistically
      queryClient.setQueriesData<TasksResponse>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old;
          const updateMap = new Map(updates.map((u) => [u.taskId, u]));
          return {
            ...old,
            tasks: old.tasks.map((task) => {
              const update = updateMap.get(task.id);
              if (update) {
                return { ...task, status: update.status as TaskStatus, position: update.position };
              }
              return task;
            }),
          };
        }
      );

      return { previousQueries };
    },
    // On error, roll back to the snapshot
    onError: (_err, _updates, context) => {
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    // Always refetch after settle to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Link plans to a task
export function useLinkTaskPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, planIds }: { taskId: string; planIds: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/tasks/${taskId}/plans`, {
        method: "POST",
        body: JSON.stringify({ planIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Unlink a plan from a task
export function useUnlinkTaskPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, planId }: { taskId: string; planId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/tasks/${taskId}/plans/${planId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Link districts to a task
export function useLinkTaskDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, leaids }: { taskId: string; leaids: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/tasks/${taskId}/districts`, {
        method: "POST",
        body: JSON.stringify({ leaids }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Unlink a district from a task
export function useUnlinkTaskDistrict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, leaid }: { taskId: string; leaid: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/tasks/${taskId}/districts/${leaid}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Link activities to a task
export function useLinkTaskActivities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, activityIds }: { taskId: string; activityIds: string[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/tasks/${taskId}/activities`, {
        method: "POST",
        body: JSON.stringify({ activityIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Unlink an activity from a task
export function useUnlinkTaskActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, activityId }: { taskId: string; activityId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/tasks/${taskId}/activities/${activityId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Link contacts to a task
export function useLinkTaskContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, contactIds }: { taskId: string; contactIds: number[] }) =>
      fetchJson<{ linked: number }>(`${API_BASE}/tasks/${taskId}/contacts`, {
        method: "POST",
        body: JSON.stringify({ contactIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}

// Unlink a contact from a task
export function useUnlinkTaskContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, contactId }: { taskId: string; contactId: number }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/tasks/${taskId}/contacts/${contactId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
    },
  });
}
