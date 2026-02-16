"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail, useRemoveDistrictFromPlan } from "@/lib/api";
import DistrictHeader from "./panels/district/DistrictHeader";
import DistrictInfoTab from "./panels/district/DistrictInfoTab";
import DataDemographicsTab from "./panels/district/DataDemographicsTab";
import ContactsTab from "./panels/district/ContactsTab";

type Tab = "info" | "data" | "contacts";

export default function FloatingDistrictDetail() {
  const detailPopout = useMapV2Store((s) => s.detailPopout);
  const closeDetailPopout = useMapV2Store((s) => s.closeDetailPopout);
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const leaid = detailPopout?.leaid ?? null;
  const { data, isLoading, error } = useDistrictDetail(leaid);
  const removeMutation = useRemoveDistrictFromPlan();

  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset state when district changes
  useEffect(() => {
    setActiveTab("info");
    setPosition({ x: 0, y: 0 });
    setShowRemoveConfirm(false);
  }, [leaid]);

  // Close on Escape
  useEffect(() => {
    if (!detailPopout) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetailPopout();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [detailPopout, closeDetailPopout]);

  // Drag handlers
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: dragStart.current.posX + dx,
        y: dragStart.current.posY + dy,
      });
    };

    const onMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  if (!detailPopout) return null;

  const contacts = data?.contacts || [];

  const handleRemove = () => {
    if (!activePlanId || !leaid) return;
    removeMutation.mutate(
      { planId: activePlanId, leaid },
      {
        onSuccess: () => {
          setShowRemoveConfirm(false);
          closeDetailPopout();
        },
      }
    );
  };

  return (
    <div
      ref={panelRef}
      data-detail-popout
      className={`
        absolute z-20 w-[400px]
        bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
        flex flex-col overflow-hidden
        ${isDragging ? "cursor-grabbing select-none" : ""}
      `}
      style={{
        top: "15vh",
        right: "2rem",
        height: "70vh",
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {/* Drag handle / header */}
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-100 ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={onMouseDown}
      >
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider select-none">
          District Detail
        </span>
        <button
          onClick={closeDetailPopout}
          className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 2L10 10M10 2L2 10"
              stroke="#9CA3AF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error || !data ? (
          <div className="text-center py-8 text-sm text-gray-400">
            Failed to load district
          </div>
        ) : (
          <>
            <DistrictHeader
              district={data.district}
              fullmindData={data.fullmindData}
              tags={data.tags}
            />

            {/* Tab bar */}
            <div className="flex border-b border-gray-100 px-1">
              {(
                [
                  { key: "info" as const, label: "District Info" },
                  { key: "data" as const, label: "Data + Demographics" },
                  {
                    key: "contacts" as const,
                    label: `Contacts (${contacts.length})`,
                  },
                ]
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                    activeTab === tab.key
                      ? "text-[#F37167]"
                      : "text-gray-500 hover:text-[#403770]"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "info" && (
              <DistrictInfoTab data={data} leaid={leaid!} />
            )}
            {activeTab === "data" && <DataDemographicsTab data={data} />}
            {activeTab === "contacts" && (
              <ContactsTab leaid={leaid!} contacts={contacts} />
            )}
          </>
        )}
      </div>

      {/* Plan actions footer */}
      {activePlanId && leaid && (
        <div className="border-t border-gray-100 px-3 py-2 flex gap-2">
          <button
            onClick={() => openRightPanel({ type: "task_form", id: leaid })}
            className="flex-1 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            + Add Task
          </button>

          {!showRemoveConfirm ? (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="flex-1 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              Remove
            </button>
          ) : (
            <div className="flex-1 flex gap-1">
              <button
                onClick={handleRemove}
                disabled={removeMutation.isPending}
                className="flex-1 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg disabled:opacity-50"
              >
                {removeMutation.isPending ? "..." : "Confirm"}
              </button>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="flex-1 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="h-5 bg-gray-200 rounded w-4/5 animate-pulse" />
      <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
      <div className="grid grid-cols-2 gap-2 mt-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
