"use client";

// DistrictCard - Card view for districts with targets, services, and quick actions
// Follows Fullmind brand with clean design and coral/plum accents

import { useState } from "react";
import Link from "next/link";
import type { TerritoryPlanDistrict } from "@/lib/api";

interface DistrictCardProps {
  district: TerritoryPlanDistrict;
  onRemove: () => void;
  onClick?: () => void;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatEnrollment(enrollment: number | null): string {
  if (!enrollment) return "N/A";
  return enrollment.toLocaleString();
}

export default function DistrictCard({ district, onRemove, onClick }: DistrictCardProps) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const hasTargets = district.revenueTarget || district.pipelineTarget;

  const handleRemove = () => {
    onRemove();
    setShowRemoveConfirm(false);
  };

  return (
    <div
      className={`group relative bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-[#C4E7E6] transition-all ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {/* Header: District Name + State */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/?leaid=${district.leaid}`}
            className="text-sm font-semibold text-[#403770] hover:text-[#F37167] transition-colors line-clamp-2"
          >
            {district.name}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            {district.stateAbbrev && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-600 rounded">
                {district.stateAbbrev}
              </span>
            )}
            <span className="text-[10px] text-gray-400 font-mono">
              {district.leaid}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/?leaid=${district.leaid}`}
            className="p-1 text-gray-400 hover:text-[#403770] transition-colors"
            aria-label="View on map"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </Link>
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Remove from plan"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Targets */}
      {hasTargets && (
        <div className="grid grid-cols-2 gap-3 mb-3 p-2 bg-gray-50 rounded-lg">
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              Revenue
            </div>
            <div className="text-sm font-semibold text-[#403770]">
              {formatCurrency(district.revenueTarget)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              Pipeline
            </div>
            <div className="text-sm font-semibold text-[#6EA3BE]">
              {formatCurrency(district.pipelineTarget)}
            </div>
          </div>
        </div>
      )}

      {/* Enrollment */}
      {district.enrollment && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>{formatEnrollment(district.enrollment)} students</span>
        </div>
      )}

      {/* Services */}
      {district.targetServices && district.targetServices.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {district.targetServices.slice(0, 4).map((service) => (
            <span
              key={service.id}
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full text-white"
              style={{ backgroundColor: service.color }}
              title={service.name}
            >
              {service.name.length > 14 ? `${service.name.slice(0, 14)}...` : service.name}
            </span>
          ))}
          {district.targetServices.length > 4 && (
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">
              +{district.targetServices.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {district.tags && district.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
          {district.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Notes indicator */}
      {district.notes && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-start gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <p className="text-[10px] text-gray-500 line-clamp-2">
              {district.notes}
            </p>
          </div>
        </div>
      )}

      {/* Inline Remove Confirmation */}
      {showRemoveConfirm && (
        <div className="absolute inset-0 bg-white/95 rounded-lg flex flex-col items-center justify-center p-4">
          <p className="text-sm text-gray-700 text-center mb-3">
            Remove from plan?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRemoveConfirm(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRemove}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
