"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useUpdateDistrictTargets, useServices, type TerritoryPlanDistrict } from "@/lib/api";
import InlineEditCell from "@/components/common/InlineEditCell";

interface DistrictsTableProps {
  planId: string;
  districts: TerritoryPlanDistrict[];
  onRemove: (leaid: string) => void;
  isRemoving?: boolean;
  onDistrictClick?: (leaid: string) => void;
}

interface ConfirmRemoveDialogProps {
  district: TerritoryPlanDistrict;
  onConfirm: () => void;
  onCancel: () => void;
  isRemoving: boolean;
}

function ConfirmRemoveDialog({
  district,
  onConfirm,
  onCancel,
  isRemoving,
}: ConfirmRemoveDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-[#403770] mb-2">
          Remove District?
        </h3>
        <p className="text-gray-600 text-sm mb-6">
          Are you sure you want to remove &ldquo;{district.name}&rdquo; from this plan?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isRemoving}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Inline service selector popover for the table
function InlineServiceSelector({
  planId,
  district,
}: {
  planId: string;
  district: TerritoryPlanDistrict;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: allServices = [] } = useServices();
  const updateTargets = useUpdateDistrictTargets();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const selectedIds = district.targetServices?.map((s) => s.id) || [];

  const toggleService = async (serviceId: number) => {
    const newIds = selectedIds.includes(serviceId)
      ? selectedIds.filter((id) => id !== serviceId)
      : [...selectedIds, serviceId];
    await updateTargets.mutateAsync({
      planId,
      leaid: district.leaid,
      serviceIds: newIds,
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex flex-wrap gap-1 items-center min-h-[28px] w-full text-left rounded-md px-1 -mx-1 hover:bg-gray-100 transition-colors group/svc"
      >
        {district.targetServices && district.targetServices.length > 0 ? (
          <>
            {district.targetServices.slice(0, 3).map((service) => (
              <span
                key={service.id}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full text-white"
                style={{ backgroundColor: service.color }}
                title={service.name}
              >
                {service.name.length > 12
                  ? `${service.name.slice(0, 12)}...`
                  : service.name}
              </span>
            ))}
            {district.targetServices.length > 3 && (
              <span className="text-xs text-gray-400">
                +{district.targetServices.length - 3}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-400 italic">Add services...</span>
        )}
        <svg
          className="w-3 h-3 text-gray-300 group-hover/svc:text-gray-500 ml-auto flex-shrink-0 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-[280px] overflow-y-auto">
          {allServices.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400 italic">
              No services available
            </div>
          ) : (
            allServices.map((service) => {
              const isSelected = selectedIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleService(service.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                    isSelected
                      ? "bg-gray-50 text-[#403770]"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? "bg-[#403770] border-[#403770]"
                        : "border-gray-300"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: service.color }}
                  />
                  <span className="truncate">{service.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatCurrencyDisplay(value: string): string {
  const num = parseFloat(value.replace(/[,$\s]/g, ""));
  if (isNaN(num)) return "-";
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[,$\s]/g, "");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export default function DistrictsTable({
  planId,
  districts,
  onRemove,
  isRemoving,
  onDistrictClick,
}: DistrictsTableProps) {
  const [confirmRemove, setConfirmRemove] = useState<TerritoryPlanDistrict | null>(null);
  const updateTargets = useUpdateDistrictTargets();

  const handleRemoveClick = (district: TerritoryPlanDistrict) => {
    setConfirmRemove(district);
  };

  const handleConfirmRemove = async () => {
    if (confirmRemove) {
      await onRemove(confirmRemove.leaid);
      setConfirmRemove(null);
    }
  };

  if (districts.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No districts yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Add districts to this plan from the map view. Select a district and click &quot;Add to Plan&quot;.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          Go to Map
        </Link>
      </div>
    );
  }

  // Calculate totals
  const totals = districts.reduce(
    (acc, d) => ({
      revenueTarget: acc.revenueTarget + (d.revenueTarget || 0),
      pipelineTarget: acc.pipelineTarget + (d.pipelineTarget || 0),
      enrollment: acc.enrollment + (d.enrollment || 0),
    }),
    { revenueTarget: 0, pipelineTarget: 0, enrollment: 0 }
  );

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                District
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                State
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Revenue Target
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Pipeline Target
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Services
              </th>
              <th className="w-20 px-3 py-3" />
            </tr>
          </thead>
        <tbody>
          {districts.map((district, idx) => {
            const isLast = idx === districts.length - 1;
            return (
            <tr
              key={district.leaid}
              className={`group transition-colors duration-100 hover:bg-gray-50/70 ${!isLast ? "border-b border-gray-100" : ""} ${onDistrictClick ? "cursor-pointer" : ""}`}
              onClick={() => onDistrictClick?.(district.leaid)}
            >
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-[#403770]">
                  {district.name}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-[13px] text-gray-600">
                  {district.stateAbbrev || "N/A"}
                </span>
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <InlineEditCell
                  type="text"
                  value={district.revenueTarget != null ? String(district.revenueTarget) : null}
                  onSave={async (value) => {
                    const parsed = parseCurrency(value);
                    await updateTargets.mutateAsync({ planId, leaid: district.leaid, revenueTarget: parsed });
                  }}
                  placeholder="-"
                  className="text-[13px] text-gray-600 text-right"
                  displayFormat={formatCurrencyDisplay}
                />
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <InlineEditCell
                  type="text"
                  value={district.pipelineTarget != null ? String(district.pipelineTarget) : null}
                  onSave={async (value) => {
                    const parsed = parseCurrency(value);
                    await updateTargets.mutateAsync({ planId, leaid: district.leaid, pipelineTarget: parsed });
                  }}
                  placeholder="-"
                  className="text-[13px] text-gray-600 text-right"
                  displayFormat={formatCurrencyDisplay}
                />
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <InlineServiceSelector planId={planId} district={district} />
              </td>
              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <Link
                    href={`/?leaid=${district.leaid}`}
                    className="p-1.5 text-gray-400 hover:text-[#403770] rounded-md hover:bg-gray-100 transition-colors"
                    aria-label="View on map"
                    title="View on Map"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleRemoveClick(district)}
                    disabled={isRemoving}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                    aria-label="Remove district"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gray-400 tracking-wide">
          {districts.length} district{districts.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-gray-400">
            Rev: <span className="font-medium text-gray-500">{formatCurrency(totals.revenueTarget)}</span>
          </span>
          <span className="text-[12px] text-gray-400">
            Pipeline: <span className="font-medium text-gray-500">{formatCurrency(totals.pipelineTarget)}</span>
          </span>
        </div>
      </div>

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <ConfirmRemoveDialog
          district={confirmRemove}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmRemove(null)}
          isRemoving={isRemoving || false}
        />
      )}

    </div>
  );
}
