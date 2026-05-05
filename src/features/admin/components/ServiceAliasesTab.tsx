"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

interface UnmappedAlias {
  alias: string;
  sources: string;
  rowCount: number;
  lastSeen: string | null;
}

interface Service {
  id: number;
  name: string;
  slug: string;
}

interface UnmappedResponse {
  rows: UnmappedAlias[];
}

function useUnmappedAliases() {
  return useQuery({
    queryKey: ["admin", "serviceAliases", "unmapped"],
    queryFn: () =>
      fetchJson<UnmappedResponse>(`${API_BASE}/admin/service-aliases/unmapped`),
    staleTime: 60_000,
  });
}

function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: () => fetchJson<Service[]>(`${API_BASE}/services`),
    staleTime: 5 * 60_000,
  });
}

function useMapAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { alias: string; serviceId?: number | null; ignored?: boolean }) =>
      fetchJson<unknown>(`${API_BASE}/admin/service-aliases`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "serviceAliases"] });
    },
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function AliasRow({
  row,
  services,
  onMap,
  pending,
}: {
  row: UnmappedAlias;
  services: Service[];
  onMap: (alias: string, serviceId: number | null, ignored: boolean) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<string>("");

  const handleApply = () => {
    if (!selected) return;
    if (selected === "__ignore__") {
      onMap(row.alias, null, true);
    } else {
      onMap(row.alias, Number(selected), false);
    }
  };

  return (
    <tr className="border-t border-[#E2DEEC]">
      <td className="px-3 py-3 font-medium text-[#403770] whitespace-nowrap">
        {row.alias}
      </td>
      <td className="px-3 py-3 text-xs text-[#8A80A8] whitespace-nowrap">{row.sources}</td>
      <td className="px-3 py-3 text-sm text-[#6E6390] tabular-nums">
        {row.rowCount.toLocaleString()}
      </td>
      <td className="px-3 py-3 text-xs text-[#8A80A8] whitespace-nowrap">
        {relativeTime(row.lastSeen)}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending}
            className="text-xs border border-[#E2DEEC] rounded-md px-2 py-1.5 bg-white text-[#403770] focus:outline-none focus:border-[#F37167]"
          >
            <option value="">Map to…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__ignore__">— Ignore</option>
          </select>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selected || pending}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-[#403770] text-white disabled:bg-[#E2DEEC] disabled:text-[#A69DC0]"
          >
            Apply
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ServiceAliasesTab() {
  const unmapped = useUnmappedAliases();
  const services = useServices();
  const map = useMapAlias();

  if (unmapped.isLoading || services.isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-[#E2DEEC]/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (unmapped.error || services.error) {
    return (
      <div className="text-sm text-[#c25a52] bg-[#F37167]/10 rounded-lg p-4">
        Failed to load service aliases.{" "}
        {(unmapped.error as Error | null)?.message ?? (services.error as Error | null)?.message}
      </div>
    );
  }

  const rows = unmapped.data?.rows ?? [];
  const allServices = services.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2DEEC] bg-white p-8 text-center">
        <p className="text-sm font-medium text-[#403770]">All service aliases are mapped.</p>
        <p className="text-xs text-[#8A80A8] mt-1">
          New strings appearing in synced sessions or subscriptions will show up here.
        </p>
      </div>
    );
  }

  const handleMap = (alias: string, serviceId: number | null, ignored: boolean) => {
    map.mutate({ alias, serviceId, ignored });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[#F7F5FA] border border-[#E2DEEC] px-4 py-3">
        <p className="text-sm text-[#6E6390]">
          <span className="font-semibold text-[#403770]">{rows.length}</span> alias
          {rows.length === 1 ? "" : "es"} from synced sessions/subscriptions{" "}
          {rows.length === 1 ? "is" : "are"} not mapped to a service in the catalog.
        </p>
      </div>

      <div className="border border-[#E2DEEC] rounded-xl overflow-hidden bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F7F5FA] text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
              <th className="text-left px-3 py-3">Alias</th>
              <th className="text-left px-3 py-3">Sources</th>
              <th className="text-left px-3 py-3 w-24">Rows</th>
              <th className="text-left px-3 py-3 w-32">Last seen</th>
              <th className="text-left px-3 py-3 w-72">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <AliasRow
                key={row.alias}
                row={row}
                services={allServices}
                onMap={handleMap}
                pending={map.isPending}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
