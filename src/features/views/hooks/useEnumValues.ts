import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import type { EnumSourceId } from "@/features/views/lib/enum-sources";

interface EnumValuesResponse {
  values: { value: string; label: string }[];
}

export function useEnumValues(enumSource: EnumSourceId | null) {
  return useQuery({
    queryKey: ["views", "enum-values", enumSource ?? ""] as const,
    queryFn: () =>
      fetchJson<EnumValuesResponse>(
        `${API_BASE}/views/enum-values?source=${enumSource}`,
      ),
    enabled: enumSource !== null,
    staleTime: Infinity,
  });
}
