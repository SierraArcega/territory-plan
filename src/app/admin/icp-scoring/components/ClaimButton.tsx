"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

interface Plan {
  id: string;
  name: string;
  color: string | null;
}

interface ClaimButtonProps {
  leaid: string;
  districtName: string;
  /** If the district already has an owner or is_customer, it's not claimable */
  isCustomer: boolean;
  owner: string | null;
  /** Compact mode for table rows */
  compact?: boolean;
}

export default function ClaimButton({ leaid, districtName, isCustomer, owner, compact }: ClaimButtonProps) {
  const [open, setOpen] = useState(false);
  const [claimedPlanName, setClaimedPlanName] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch user's plans
  const { data: plans } = useQuery({
    queryKey: ["territoryPlans"],
    queryFn: () => fetchJson<Plan[]>(`${API_BASE}/territory-plans`),
    staleTime: 60 * 1000,
  });

  // Check which plans already contain this district
  const { data: existingPlanIds } = useQuery({
    queryKey: ["districtPlans", leaid],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/territory-plans?districtLeaid=${leaid}`);
      if (!res.ok) return [];
      const data = await res.json();
      // The API returns plans; extract IDs of plans that contain this district
      return Array.isArray(data) ? data.map((p: Plan) => p.id) : [];
    },
    staleTime: 30 * 1000,
    enabled: open, // Only fetch when dropdown is open
  });

  const existingSet = new Set(existingPlanIds ?? []);

  // Add district to plan mutation
  const addToPlan = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`${API_BASE}/territory-plans/${planId}/districts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaids: [leaid] }),
      });
      if (!res.ok) throw new Error("Failed to add district");
      return res.json();
    },
    onSuccess: (_, planId) => {
      const plan = plans?.find((p) => p.id === planId);
      setClaimedPlanName(plan?.name ?? "Plan");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["districtPlans", leaid] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Already claimed this session
  if (claimedPlanName) {
    return (
      <span className={`inline-flex items-center gap-1 text-[#69B34A] ${compact ? "text-[10px]" : "text-xs"} font-medium`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Added to {claimedPlanName}
      </span>
    );
  }

  // Customer or already owned — show status instead
  if (isCustomer) {
    return (
      <span className={`${compact ? "text-[10px]" : "text-xs"} font-medium text-[#8A80A8]`}>
        Customer
      </span>
    );
  }

  if (owner) {
    return (
      <span className={`${compact ? "text-[10px]" : "text-xs"} font-medium text-[#8A80A8]`}>
        Owned by {owner.split("@")[0]}
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-1 font-semibold rounded-lg border transition-colors ${
          compact
            ? "text-[10px] px-2 py-0.5 border-[#D4CFE2] text-[#403770] hover:bg-[#EFEDF5]"
            : "text-xs px-2.5 py-1 border-[#403770]/20 text-[#403770] hover:bg-[#403770] hover:text-white"
        }`}
      >
        <svg className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add to Plan
      </button>

      {open && plans && plans.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 z-50 py-1 max-h-64 overflow-y-auto">
          <div className="px-3 py-2 border-b border-[#E2DEEC]">
            <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
              Add "{districtName.length > 25 ? districtName.slice(0, 25) + "..." : districtName}" to:
            </p>
          </div>
          {plans.map((plan) => {
            const alreadyIn = existingSet.has(plan.id);
            return (
              <button
                key={plan.id}
                disabled={alreadyIn || addToPlan.isPending}
                onClick={(e) => { e.stopPropagation(); addToPlan.mutate(plan.id); }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                  alreadyIn
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-[#EFEDF5]"
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: plan.color || "#403770" }}
                />
                <span className="text-sm text-[#544A78] truncate">{plan.name}</span>
                {alreadyIn && (
                  <span className="ml-auto text-[10px] text-[#A69DC0] shrink-0">already added</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {open && (!plans || plans.length === 0) && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 z-50 p-3">
          <p className="text-xs text-[#8A80A8]">No plans yet. Create a plan first from the Plans tab.</p>
        </div>
      )}
    </div>
  );
}
