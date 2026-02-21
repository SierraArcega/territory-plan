"use client";

import { useState, useEffect } from "react";
import { useServices, useUpdateDistrictTargets } from "@/lib/api";
import ServiceSelector from "./ServiceSelector";

interface DistrictTargetEditorProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  district: {
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    enrollment: number | null;
    renewalTarget: number | null;
    winbackTarget: number | null;
    expansionTarget: number | null;
    newBusinessTarget: number | null;
    notes: string | null;
    returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
    newServices: Array<{ id: number; name: string; slug: string; color: string }>;
  };
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[,$\s]/g, "");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export default function DistrictTargetEditor({
  isOpen,
  onClose,
  planId,
  district,
}: DistrictTargetEditorProps) {
  const [renewalTarget, setRenewalTarget] = useState("");
  const [winbackTarget, setWinbackTarget] = useState("");
  const [expansionTarget, setExpansionTarget] = useState("");
  const [newBusinessTarget, setNewBusinessTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [returnServiceIds, setReturnServiceIds] = useState<number[]>([]);
  const [newServiceIds, setNewServiceIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: services = [] } = useServices();
  const updateTargets = useUpdateDistrictTargets();

  // Reset form when modal opens or district changes
  useEffect(() => {
    if (isOpen) {
      setRenewalTarget(formatCurrency(district.renewalTarget));
      setWinbackTarget(formatCurrency(district.winbackTarget));
      setExpansionTarget(formatCurrency(district.expansionTarget));
      setNewBusinessTarget(formatCurrency(district.newBusinessTarget));
      setNotes(district.notes || "");
      setReturnServiceIds(district.returnServices.map((s) => s.id));
      setNewServiceIds(district.newServices.map((s) => s.id));
      setError(null);
    }
  }, [isOpen, district]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await updateTargets.mutateAsync({
        planId,
        leaid: district.leaid,
        renewalTarget: parseCurrency(renewalTarget),
        winbackTarget: parseCurrency(winbackTarget),
        expansionTarget: parseCurrency(expansionTarget),
        newBusinessTarget: parseCurrency(newBusinessTarget),
        notes: notes.trim() || null,
        returnServiceIds,
        newServiceIds,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save targets");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#403770]">District Targets</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {district.name}
              {district.stateAbbrev && `, ${district.stateAbbrev}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Renewal Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Renewal Target
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="text"
                  value={renewalTarget}
                  onChange={(e) => setRenewalTarget(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Expected renewal revenue from existing services
              </p>
            </div>

            {/* Winback Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Winback Target
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="text"
                  value={winbackTarget}
                  onChange={(e) => setWinbackTarget(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Revenue from winning back lapsed business
              </p>
            </div>

            {/* Expansion Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expansion Target
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="text"
                  value={expansionTarget}
                  onChange={(e) => setExpansionTarget(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Revenue from expanding existing customer relationships
              </p>
            </div>

            {/* New Business Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Business Target
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="text"
                  value={newBusinessTarget}
                  onChange={(e) => setNewBusinessTarget(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Revenue from brand new customer acquisition
              </p>
            </div>

            {/* Return Services */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Return Services
              </label>
              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <ServiceSelector
                  services={services}
                  selectedIds={returnServiceIds}
                  onChange={setReturnServiceIds}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Services this district is expected to renew or return to
              </p>
            </div>

            {/* New Services */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Services
              </label>
              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <ServiceSelector
                  services={services}
                  selectedIds={newServiceIds}
                  onChange={setNewServiceIds}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                New services you plan to sell to this district
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this district's targets..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateTargets.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateTargets.isPending ? "Saving..." : "Save Targets"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
