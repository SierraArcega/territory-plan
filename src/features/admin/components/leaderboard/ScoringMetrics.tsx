"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import CollapsibleSection from "./CollapsibleSection";
import PreviewConfirmModal from "./PreviewConfirmModal";
import MetricPicker from "./MetricPicker";
import {
  useMetricRegistry,
  useUpdateMetrics,
  usePreviewChanges,
} from "@/features/admin/hooks/useAdminLeaderboard";
import type { AdminInitiativeConfig, RegistryEntry } from "@/features/admin/lib/leaderboard-types";

interface ScoringMetricsProps {
  config: AdminInitiativeConfig;
}

interface DraftMetric {
  action: string;
  label: string;
  pointValue: number;
}

export default function ScoringMetrics({ config }: ScoringMetricsProps) {
  const [metrics, setMetrics] = useState<DraftMetric[]>(
    config.metrics.map((m) => ({
      action: m.action,
      label: m.label,
      pointValue: m.pointValue,
    }))
  );
  const [showPreview, setShowPreview] = useState(false);
  const [showMetricWarning, setShowMetricWarning] = useState(false);
  const [pendingEntry, setPendingEntry] = useState<RegistryEntry | null>(null);

  useEffect(() => {
    setMetrics(
      config.metrics.map((m) => ({
        action: m.action,
        label: m.label,
        pointValue: m.pointValue,
      }))
    );
  }, [config.metrics]);

  const { data: registry = [] } = useMetricRegistry();
  const updateMutation = useUpdateMetrics();
  const previewMutation = usePreviewChanges();

  const descriptionMap = new Map(registry.map((r) => [r.action, r.description]));

  const addMetric = (entry: RegistryEntry) => {
    if (metrics.length >= 5 && !showMetricWarning) {
      setPendingEntry(entry);
      setShowMetricWarning(true);
      return;
    }
    setMetrics([
      ...metrics,
      { action: entry.action, label: entry.label, pointValue: 5 },
    ]);
    setShowMetricWarning(false);
    setPendingEntry(null);
  };

  const confirmAddMetric = () => {
    if (pendingEntry) {
      setMetrics([
        ...metrics,
        { action: pendingEntry.action, label: pendingEntry.label, pointValue: 5 },
      ]);
    }
    setShowMetricWarning(false);
    setPendingEntry(null);
  };

  const removeMetric = (action: string) => {
    setMetrics(metrics.filter((m) => m.action !== action));
  };

  const updateMetric = (action: string, value: number) => {
    setMetrics(metrics.map((m) => (m.action === action ? { ...m, pointValue: value } : m)));
  };

  const metricsWithWeight = metrics.map((m) => ({ ...m, weight: 1.0 }));

  const handleSave = () => {
    previewMutation.mutate(
      { section: "metrics", data: { metrics: metricsWithWeight } },
      { onSuccess: () => setShowPreview(true) }
    );
  };

  const handleConfirm = () => {
    updateMutation.mutate({ metrics: metricsWithWeight }, { onSuccess: () => setShowPreview(false) });
  };

  return (
    <>
      <CollapsibleSection
        title="Scoring Metrics"
        subtitle={`${metrics.length} active metric${metrics.length !== 1 ? "s" : ""} \u00b7 ${registry.length - metrics.length} available actions`}
      >
        <div className="space-y-4">
          <MetricPicker
            entries={registry}
            excludeActions={metrics.map((m) => m.action)}
            onSelect={addMetric}
          />

          {showMetricWarning && (
            <div className="bg-[#fffaf1] border border-[#ffd98d] rounded-lg p-4">
              <p className="text-sm text-[#403770] font-medium">Add more than 5 metrics?</p>
              <p className="text-sm text-[#6E6390] mt-1">
                More metrics can dilute scoring signals and make it harder for reps to understand
                what drives their rank.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setShowMetricWarning(false);
                    setPendingEntry(null);
                  }}
                  className="px-3 py-1.5 text-sm text-[#6E6390] hover:bg-[#F7F5FA] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddMetric}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg"
                >
                  Add Anyway
                </button>
              </div>
            </div>
          )}

          {metrics.length > 0 && (
            <div className="border border-[#E2DEEC] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F7F5FA] text-xs font-medium text-[#8A80A8] uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Action</th>
                    <th className="text-left px-4 py-2">Label</th>
                    <th className="text-right px-4 py-2 w-24">Points</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.action} className="border-t border-[#E2DEEC] hover:bg-[#EFEDF5]">
                      <td className="px-4 py-2 text-sm text-[#8A80A8] font-mono">{m.action}</td>
                      <td className="px-4 py-2">
                        <div className="text-sm text-[#403770]">{m.label}</div>
                        {descriptionMap.get(m.action) && (
                          <div className="text-xs text-[#8A80A8] mt-0.5">{descriptionMap.get(m.action)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          value={m.pointValue}
                          onChange={(e) =>
                            updateMetric(m.action, parseInt(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 text-sm text-right border border-[#C2BBD4] rounded text-[#403770] focus:border-[#403770] focus:ring-1 focus:ring-[#403770]/30 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeMetric(m.action)}
                          className="text-[#A69DC0] hover:text-[#F37167] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
