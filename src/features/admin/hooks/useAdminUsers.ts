import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  role: "admin" | "user";
  jobTitle: string | null;
  lastLoginAt: string | null;
  hasCompletedSetup: boolean;
  createdAt: string;
}

interface AdminUsersResponse {
  items: AdminUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

interface UseAdminUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
}

export function useAdminUsers(params: UseAdminUsersParams = {}) {
  const { page = 1, pageSize = 20, search = "", role = "" } = params;

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("page_size", String(pageSize));
  if (search) searchParams.set("search", search);
  if (role) searchParams.set("role", role);

  return useQuery({
    queryKey: ["admin", "users", { page, pageSize, search, role }],
    queryFn: () =>
      fetchJson<AdminUsersResponse>(
        `${API_BASE}/admin/users?${searchParams}`
      ),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
