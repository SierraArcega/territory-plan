"use client";

import { useState, useEffect, useRef } from "react";
import { useMapV2Store, ALL_METRIC_IDS, type MetricId } from "@/features/map/lib/store";
import type { MapViewState } from "@/features/map/lib/store";
import { useCreateMapView, useMapViews } from "@/features/map/lib/map-view-queries";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

type ActivePopover = "save" | "load" | "metrics" | null;

export default function ViewActionsBar() {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggle = (p: ActivePopover) =>
    setActivePopover((cur) => (cur === p ? null : p));

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-200/60">
        <ActionBtn label="Save View" onClick={() => toggle("save")} />
        <ActionBtn label="Load View" onClick={() => toggle("load")} />
        <div className="w-px h-4 bg-gray-200/60 shrink-0" />
        <button
          onClick={() => toggle("metrics")}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors"
          title="Configure visible metrics"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {activePopover === "save" && (
        <SaveViewPopover
          onClose={() => setActivePopover(null)}
          onSuccess={(name) => {
            setActivePopover(null);
            setToast(`Saved view "${name}"`);
          }}
        />
      )}
      {activePopover === "load" && (
        <LoadViewPopover
          onClose={() => setActivePopover(null)}
          onLoaded={(name) => {
            setActivePopover(null);
            setToast(`Loaded view "${name}"`);
          }}
        />
      )}
      {activePopover === "metrics" && (
        <MetricsPopover onClose={() => setActivePopover(null)} />
      )}

      {toast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
    >
      {label}
    </button>
  );
}

function Popover({
  onClose,
  children,
  position = "below",
}: {
  onClose: () => void;
  children: React.ReactNode;
  position?: "below" | "above";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const posClass =
    position === "above"
      ? "bottom-full left-3 mb-1"
      : "top-full left-3 mt-1";

  return (
    <div
      ref={ref}
      className={`absolute ${posClass} w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-20`}
    >
      {children}
    </div>
  );
}

function SaveViewPopover({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getViewSnapshot = useMapV2Store((s) => s.getViewSnapshot);
  const createView = useCreateMapView();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      await createView.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        isShared,
        state: getViewSnapshot() as unknown as Record<string, unknown>,
      });
      onSuccess(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save view");
    }
  };

  return (
    <Popover onClose={onClose} position="above">
      <div className="text-xs font-semibold text-gray-700 mb-2">Save View</div>
      <input
        ref={inputRef}
        type="text"
        placeholder="View name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2"
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2 resize-none"
      />
      <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isShared}
          onChange={(e) => setIsShared(e.target.checked)}
          className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
        />
        Share with team
      </label>
      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || createView.isPending}
          className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
        >
          {createView.isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </Popover>
  );
}

function LoadViewPopover({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: (name: string) => void;
}) {
  const { data: views, isLoading } = useMapViews();
  const applyViewSnapshot = useMapV2Store((s) => s.applyViewSnapshot);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (viewId: string, viewName: string) => {
    setError(null);
    try {
      const detail = await fetchJson<{ state: MapViewState }>(
        `${API_BASE}/map-views/${viewId}`
      );
      applyViewSnapshot(detail.state);
      onLoaded(viewName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load view");
    }
  };

  return (
    <Popover onClose={onClose} position="above">
      <div className="text-xs font-semibold text-gray-700 mb-2">Load View</div>
      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-gray-400 py-2">Loading...</div>
      ) : !views?.length ? (
        <div className="text-xs text-gray-400 py-2">No saved views yet</div>
      ) : (
        <div className="max-h-48 overflow-y-auto -mx-1">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => handleLoad(v.id, v.name)}
              className="w-full text-left text-xs text-gray-600 hover:bg-gray-100 rounded px-2 py-1.5 truncate"
            >
              {v.name}
              {v.isShared && (
                <span className="text-gray-400 ml-1 text-[10px]">shared</span>
              )}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

const METRIC_LABELS: Record<MetricId, string> = {
  districts: "Districts",
  enrollment: "Enrollment",
  pipeline: "Pipeline",
  bookings: "Bookings",
  invoicing: "Invoicing",
  scheduledRevenue: "Sched Rev",
  deliveredRevenue: "Deliv Rev",
  deferredRevenue: "Def Rev",
  totalRevenue: "Total Rev",
  deliveredTake: "Deliv Take",
  scheduledTake: "Sched Take",
  allTake: "All Take",
};

function MetricsPopover({ onClose }: { onClose: () => void }) {
  const visibleMetrics = useMapV2Store((s) => s.visibleMetrics);
  const toggleMetric = useMapV2Store((s) => s.toggleMetric);

  return (
    <Popover onClose={onClose} position="above">
      <div className="text-xs font-semibold text-gray-700 mb-2">Visible Metrics</div>
      <div className="space-y-0.5">
        {ALL_METRIC_IDS.map((id) => (
          <label
            key={id}
            className="flex items-center gap-2 text-xs text-gray-600 py-1 px-1 rounded hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={visibleMetrics.has(id)}
              onChange={() => toggleMetric(id)}
              className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
            />
            {METRIC_LABELS[id]}
          </label>
        ))}
      </div>
    </Popover>
  );
}
