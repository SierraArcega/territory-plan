"use client";

import { useState, useEffect } from "react";
import CollapsibleSection from "./CollapsibleSection";
import PreviewConfirmModal from "./PreviewConfirmModal";
import {
  useUpdateInitiativeIdentity,
  usePreviewChanges,
} from "@/features/admin/hooks/useAdminLeaderboard";
import type { AdminInitiativeConfig } from "@/features/admin/lib/leaderboard-types";

interface InitiativeIdentityProps {
  config: AdminInitiativeConfig;
}

export default function InitiativeIdentity({ config }: InitiativeIdentityProps) {
  const { initiative } = config;

  const [name, setName] = useState(initiative.name);
  const [startDate, setStartDate] = useState(initiative.startDate.split("T")[0]);
  const [endDate, setEndDate] = useState(initiative.endDate?.split("T")[0] ?? "");
  const [showName, setShowName] = useState(initiative.showName);
  const [showDates, setShowDates] = useState(initiative.showDates);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setName(initiative.name);
    setStartDate(initiative.startDate.split("T")[0]);
    setEndDate(initiative.endDate?.split("T")[0] ?? "");
    setShowName(initiative.showName);
    setShowDates(initiative.showDates);
  }, [initiative]);

  const updateMutation = useUpdateInitiativeIdentity();
  const previewMutation = usePreviewChanges();

  const payload = {
    name,
    startDate: new Date(startDate).toISOString(),
    endDate: endDate ? new Date(endDate).toISOString() : null,
    showName,
    showDates,
  };

  const handleSave = () => {
    previewMutation.mutate(
      { section: "initiative", data: payload },
      { onSuccess: () => setShowPreview(true) }
    );
  };

  const handleConfirm = () => {
    updateMutation.mutate(payload, {
      onSuccess: () => setShowPreview(false),
    });
  };

  return (
    <>
      <CollapsibleSection title="Initiative Identity" defaultOpen>
        <div className="space-y-4">
          {/* Active since banner */}
          {initiative.isActive && (
            <div className="px-3 py-2 bg-[#F7FFF2] border border-[#69B34A]/20 rounded-lg text-sm text-[#4A8A2F]">
              This initiative has been active since{" "}
              <span className="font-medium">
                {new Date(initiative.startDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {initiative.endDate && (
                <>
                  {" "}and is set to end{" "}
                  <span className="font-medium">
                    {new Date(initiative.endDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Initiative UID (read-only) */}
          <div>
            <label className="block text-sm font-medium text-[#6E6390] mb-1">Initiative UID</label>
            <div className="px-3 py-2 bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg text-sm text-[#8A80A8] font-mono">
              {initiative.initiativeUid ?? "\u2014"}
            </div>
          </div>

          {/* Initiative Name */}
          <div>
            <label className="block text-sm font-medium text-[#6E6390] mb-1">Initiative Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none"
              placeholder="e.g. Spring Initiative"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#6E6390] mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#6E6390] mb-1">
                End Date <span className="text-[#A69DC0]">(optional)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none"
              />
            </div>
          </div>

          {/* Status badge */}
          <div>
            <label className="block text-sm font-medium text-[#6E6390] mb-1">Status</label>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                initiative.isActive
                  ? "bg-[#F7FFF2] text-[#69B34A]"
                  : "bg-[#F7F5FA] text-[#8A80A8]"
              }`}
            >
              {initiative.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Visibility toggles */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#6E6390]">Visibility to Reps</label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showName}
                onChange={(e) => setShowName(e.target.checked)}
                className="w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30"
              />
              <span className="text-sm text-[#6E6390]">Show initiative name</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showDates}
                onChange={(e) => setShowDates(e.target.checked)}
                className="w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30"
              />
              <span className="text-sm text-[#6E6390]">Show initiative dates</span>
            </label>
          </div>

          {/* Save button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={previewMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50"
            >
              {previewMutation.isPending ? "Loading preview..." : "Save Changes"}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <PreviewConfirmModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirm}
        preview={previewMutation.data ?? null}
        isLoading={previewMutation.isPending}
        isSaving={updateMutation.isPending}
      />
    </>
  );
}
