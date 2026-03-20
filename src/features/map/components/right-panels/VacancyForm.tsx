"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { useMapV2Store } from "@/features/map/lib/store";

interface VacancyFormProps {
  vacancyId: string;
}

interface VacancyData {
  id: string;
  title: string;
  category: string | null;
  status: string;
  fullmindRelevant: boolean;
  hiringManager: string | null;
  hiringEmail: string | null;
  notes?: string | null;
  contactId?: number | null;
  leaid: string;
}

const CATEGORY_OPTIONS = [
  { value: "SPED", label: "SPED" },
  { value: "ELL", label: "ELL" },
  { value: "General Ed", label: "General Ed" },
  { value: "Admin", label: "Admin" },
  { value: "Specialist", label: "Specialist" },
  { value: "Counseling", label: "Counseling" },
  { value: "Related Services", label: "Related Services" },
  { value: "Other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "expired", label: "Expired" },
];

export default function VacancyForm({ vacancyId }: VacancyFormProps) {
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);
  const queryClient = useQueryClient();

  const { data: vacancy, isLoading } = useQuery({
    queryKey: ["vacancyDetail", vacancyId],
    queryFn: () => fetchJson<VacancyData>(`${API_BASE}/vacancies/${encodeURIComponent(vacancyId)}`),
    enabled: !!vacancyId,
    staleTime: 2 * 60 * 1000,
  });

  const [status, setStatus] = useState("open");
  const [category, setCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Populate form when data loads
  useEffect(() => {
    if (vacancy) {
      setStatus(vacancy.status);
      setCategory(vacancy.category);
      setNotes(vacancy.notes ?? "");
    }
  }, [vacancy]);

  const updateVacancy = useMutation({
    mutationFn: (updates: { status?: string; category?: string | null; notes?: string | null }) =>
      fetchJson(`${API_BASE}/vacancies/${encodeURIComponent(vacancyId)}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacancyDetail", vacancyId] });
      queryClient.invalidateQueries({ queryKey: ["mapVacancies"] });
      openRightPanel({ type: "vacancy_detail", id: vacancyId });
    },
  });

  const handleSave = async () => {
    try {
      await updateVacancy.mutateAsync({
        status,
        category,
        notes: notes.trim() || null,
      });
    } catch {
      // Error handled by react-query
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!vacancy) {
    return (
      <div className="text-center py-8 text-xs text-[#A69DC0]">
        Vacancy not found
      </div>
    );
  }

  const isSaving = updateVacancy.isPending;

  return (
    <div className="space-y-4">
      {/* Title (read-only) */}
      <div>
        <div className="text-[9px] font-medium text-[#A69DC0] uppercase tracking-wider mb-0.5">
          Title
        </div>
        <p className="text-sm font-medium text-[#403770]">{vacancy.title}</p>
      </div>

      {/* Status */}
      <div>
        <label className="block text-[10px] font-medium text-[#8A80A8] uppercase tracking-wider mb-1.5">
          Status
        </label>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = status === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={[
                  "flex-1 flex items-center justify-center px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all",
                  isSelected
                    ? "bg-[#403770] text-white"
                    : "bg-[#F7F5FA] text-[#8A80A8] hover:bg-[#EFEDF5]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-[10px] font-medium text-[#8A80A8] uppercase tracking-wider mb-1">
          Category
        </label>
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || null)}
          className="w-full px-3 py-2 text-xs border border-[#C2BBD4] rounded-lg bg-white text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        >
          <option value="">Uncategorized</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[10px] font-medium text-[#8A80A8] uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..."
          rows={3}
          className="w-full px-3 py-2 text-xs rounded-lg border border-[#C2BBD4] bg-white text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-2 bg-[#403770] text-white text-xs font-medium rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={() => openRightPanel({ type: "vacancy_detail", id: vacancyId })}
          className="w-full py-2 text-[#8A80A8] text-xs font-medium rounded-lg hover:bg-[#F7F5FA] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <div className="h-2 bg-[#E2DEEC] rounded w-10 mb-1 animate-pulse" />
        <div className="h-4 bg-[#E2DEEC] rounded w-3/4 animate-pulse" />
      </div>
      <div>
        <div className="h-2 bg-[#E2DEEC] rounded w-14 mb-1.5 animate-pulse" />
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 h-8 bg-[#F7F5FA] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-2 bg-[#E2DEEC] rounded w-16 mb-1 animate-pulse" />
        <div className="h-9 bg-[#F7F5FA] rounded-lg animate-pulse" />
      </div>
      <div>
        <div className="h-2 bg-[#E2DEEC] rounded w-12 mb-1 animate-pulse" />
        <div className="h-16 bg-[#F7F5FA] rounded-lg animate-pulse" />
      </div>
      <div className="h-9 bg-[#E2DEEC] rounded-lg animate-pulse" />
    </div>
  );
}
