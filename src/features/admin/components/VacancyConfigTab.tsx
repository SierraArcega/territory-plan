"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

// ---------- Types ----------

interface VacancyKeywordConfig {
  id: number;
  type: "relevance" | "exclusion";
  label: string;
  keywords: string[];
  serviceLine: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VacancyConfigResponse {
  configs: VacancyKeywordConfig[];
}

interface ConfigFormData {
  type: "relevance" | "exclusion";
  label: string;
  keywords: string;
  serviceLine: string;
}

// ---------- Query Hooks ----------

function useVacancyConfigs() {
  return useQuery({
    queryKey: ["admin", "vacancyConfig"],
    queryFn: () =>
      fetchJson<VacancyConfigResponse>(`${API_BASE}/admin/vacancy-config`),
    staleTime: 2 * 60 * 1000,
  });
}

function useCreateVacancyConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      type: "relevance" | "exclusion";
      label: string;
      keywords: string[];
      serviceLine?: string;
    }) =>
      fetchJson<{ config: VacancyKeywordConfig }>(
        `${API_BASE}/admin/vacancy-config`,
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "vacancyConfig"] });
    },
  });
}

function useUpdateVacancyConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
      type?: "relevance" | "exclusion";
      label?: string;
      keywords?: string[];
      serviceLine?: string | null;
    }) =>
      fetchJson<{ config: VacancyKeywordConfig }>(
        `${API_BASE}/admin/vacancy-config/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "vacancyConfig"] });
    },
  });
}

function useDeleteVacancyConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/admin/vacancy-config/${id}`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "vacancyConfig"] });
    },
  });
}

// ---------- Sub-components ----------

const EMPTY_FORM: ConfigFormData = {
  type: "relevance",
  label: "",
  keywords: "",
  serviceLine: "",
};

function ConfigForm({
  initialData,
  configType,
  onSubmit,
  onCancel,
  isPending,
}: {
  initialData?: ConfigFormData;
  configType: "relevance" | "exclusion";
  onSubmit: (data: ConfigFormData) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ConfigFormData>(
    initialData ?? { ...EMPTY_FORM, type: configType }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !form.keywords.trim()) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#F7F5FA] rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
            Label
          </label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="e.g., Speech-Language Pathology"
            className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg focus:outline-none focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30"
            required
          />
        </div>

        {configType === "relevance" && (
          <div>
            <label className="block text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
              Service Line
            </label>
            <input
              type="text"
              value={form.serviceLine}
              onChange={(e) =>
                setForm((f) => ({ ...f, serviceLine: e.target.value }))
              }
              placeholder="e.g., SLP"
              className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg focus:outline-none focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
          Keywords (comma-separated)
        </label>
        <input
          type="text"
          value={form.keywords}
          onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
          placeholder="e.g., speech pathologist, SLP, speech therapist"
          className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg focus:outline-none focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30"
          required
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !form.label.trim() || !form.keywords.trim()}
          className="px-4 py-1.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving..." : initialData ? "Update" : "Add"}
        </button>
      </div>
    </form>
  );
}

function KeywordPills({ keywords }: { keywords: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {keywords.map((kw) => (
        <span
          key={kw}
          className="inline-flex px-2 py-0.5 text-[11px] font-medium bg-[#EFEDF5] text-[#6E6390] rounded-full"
        >
          {kw}
        </span>
      ))}
    </div>
  );
}

// ---------- Section Component ----------

function ConfigSection({
  title,
  description,
  configType,
  configs,
  isLoading,
}: {
  title: string;
  description: string;
  configType: "relevance" | "exclusion";
  configs: VacancyKeywordConfig[];
  isLoading: boolean;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const createConfig = useCreateVacancyConfig();
  const updateConfig = useUpdateVacancyConfig();
  const deleteConfig = useDeleteVacancyConfig();

  const handleCreate = useCallback(
    async (data: ConfigFormData) => {
      const keywords = data.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      await createConfig.mutateAsync({
        type: configType,
        label: data.label.trim(),
        keywords,
        serviceLine: data.serviceLine.trim() || undefined,
      });
      setShowAddForm(false);
    },
    [createConfig, configType]
  );

  const handleUpdate = useCallback(
    async (id: number, data: ConfigFormData) => {
      const keywords = data.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      await updateConfig.mutateAsync({
        id,
        label: data.label.trim(),
        keywords,
        serviceLine:
          configType === "relevance"
            ? data.serviceLine.trim() || null
            : undefined,
      });
      setEditingId(null);
    },
    [updateConfig, configType]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      setDeletingId(id);
      try {
        await deleteConfig.mutateAsync(id);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteConfig]
  );

  const filtered = configs.filter((c) => c.type === configType);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-[#403770]">{title}</h3>
          <p className="text-xs text-[#8A80A8] mt-0.5">{description}</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-4">
          <ConfigForm
            configType={configType}
            onSubmit={handleCreate}
            onCancel={() => setShowAddForm(false)}
            isPending={createConfig.isPending}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden border border-[#E2DEEC] rounded-lg bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F5FA]">
                <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Label
                </th>
                {configType === "relevance" && (
                  <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                    Service Line
                  </th>
                )}
                <th className="text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Keywords
                </th>
                <th className="text-right text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={configType === "relevance" ? 4 : 3}
                    className="px-4 py-12 text-center text-sm text-[#8A80A8]"
                  >
                    Loading configs...
                  </td>
                </tr>
              )}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={configType === "relevance" ? 4 : 3}
                    className="px-4 py-12 text-center text-sm text-[#8A80A8]"
                  >
                    No {configType === "relevance" ? "service line keywords" : "role exclusions"} configured yet.
                  </td>
                </tr>
              )}

              {filtered.map((config, idx) => {
                const isEditing = editingId === config.id;

                if (isEditing) {
                  return (
                    <tr key={config.id}>
                      <td
                        colSpan={configType === "relevance" ? 4 : 3}
                        className="px-4 py-3"
                      >
                        <ConfigForm
                          initialData={{
                            type: config.type as "relevance" | "exclusion",
                            label: config.label,
                            keywords: config.keywords.join(", "),
                            serviceLine: config.serviceLine ?? "",
                          }}
                          configType={configType}
                          onSubmit={(data) => handleUpdate(config.id, data)}
                          onCancel={() => setEditingId(null)}
                          isPending={updateConfig.isPending}
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={config.id}
                    className={`group hover:bg-[#EFEDF5] transition-colors${
                      idx < filtered.length - 1
                        ? " border-b border-[#E2DEEC]"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-[#403770]">
                        {config.label}
                      </span>
                    </td>
                    {configType === "relevance" && (
                      <td className="px-4 py-3">
                        {config.serviceLine ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-[#6EA3BE]/15 text-[#4d7285] rounded-full">
                            {config.serviceLine}
                          </span>
                        ) : (
                          <span className="text-sm text-[#A69DC0]">{"\u2014"}</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <KeywordPills keywords={config.keywords} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingId(config.id)}
                          className="p-1.5 text-[#A69DC0] hover:text-[#403770] transition-colors"
                          aria-label={`Edit ${config.label}`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(config.id)}
                          disabled={deletingId === config.id}
                          className="p-1.5 text-[#A69DC0] hover:text-red-500 transition-colors disabled:opacity-50"
                          aria-label={`Delete ${config.label}`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Component ----------

export default function VacancyConfigTab() {
  const { data, isLoading } = useVacancyConfigs();
  const configs = data?.configs ?? [];

  return (
    <div className="space-y-8">
      <ConfigSection
        title="Service Line Keywords"
        description="Keywords that flag a vacancy as relevant to a Fullmind service line."
        configType="relevance"
        configs={configs}
        isLoading={isLoading}
      />

      <ConfigSection
        title="Role Exclusions"
        description="Keywords that exclude a vacancy from results (e.g., administrative roles not relevant to Fullmind)."
        configType="exclusion"
        configs={configs}
        isLoading={isLoading}
      />
    </div>
  );
}
