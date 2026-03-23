"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { unmatchedOpportunityColumns } from "./columns";
import { DataGrid } from "@/features/shared/components/DataGrid/DataGrid";
import type { SortRule, FilterRule, CellRendererFn } from "@/features/shared/components/DataGrid/types";
import AdminFilterBar from "./AdminFilterBar";
import AdminColumnPicker from "./AdminColumnPicker";
import { US_STATES } from "@/lib/states";
import { ACCOUNT_TYPES } from "@/features/shared/types/account-types";
import type { AccountTypeValue } from "@/features/shared/types/account-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnmatchedOpportunity {
  id: string;
  name: string | null;
  accountName: string | null;
  state: string | null;
  schoolYr: string | null;
  stage: string | null;
  netBookingAmount: string | null;
  reason: string | null;
  resolved: boolean;
  resolvedDistrictLeaid: string | null;
}

interface DistrictResult {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  cityLocation: string | null;
}

interface SchoolResult {
  ncessch: string;
  leaid: string;
  schoolName: string;
  city: string;
  stateAbbrev: string;
  enrollment: number | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchOpportunities(params: {
  resolved?: string;
  school_yr?: string;
  state?: string;
  stage?: string;
  reason?: string;
  search?: string;
  has_district_id?: string;
  stage_group?: string;
  sort_by?: string;
  sort_dir?: string;
  page: number;
  page_size: number;
}): Promise<{ items: UnmatchedOpportunity[]; pagination: PaginationInfo }> {
  const qs = new URLSearchParams();
  if (params.resolved) qs.set("resolved", params.resolved);
  if (params.school_yr) qs.set("school_yr", params.school_yr);
  if (params.state) qs.set("state", params.state);
  if (params.stage) qs.set("stage", params.stage);
  if (params.reason) qs.set("reason", params.reason);
  if (params.search) qs.set("search", params.search);
  if (params.has_district_id) qs.set("has_district_id", params.has_district_id);
  if (params.stage_group) qs.set("stage_group", params.stage_group);
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  qs.set("page", String(params.page));
  qs.set("page_size", String(params.page_size));
  const res = await fetch(`/api/admin/unmatched-opportunities?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchFacets(): Promise<{ stages: string[]; reasons: string[] }> {
  const res = await fetch("/api/admin/unmatched-opportunities/facets");
  if (!res.ok) throw new Error("Failed to fetch facets");
  return res.json();
}

async function searchDistricts(q: string): Promise<{ items: DistrictResult[] }> {
  if (q.length < 2) return { items: [] };
  const res = await fetch(`/api/admin/districts/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Failed to search districts");
  return res.json();
}

async function searchSchools(q: string): Promise<{ schools: SchoolResult[] }> {
  if (q.length < 2) return { schools: [] };
  const res = await fetch(`/api/schools?search=${encodeURIComponent(q)}&limit=10`);
  if (!res.ok) throw new Error("Failed to search schools");
  return res.json();
}

async function fetchSuggestions(name: string, state?: string | null): Promise<{ items: DistrictResult[] }> {
  const qs = new URLSearchParams({ name });
  if (state) qs.set("state", state);
  const res = await fetch(`/api/admin/districts/suggestions?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch suggestions");
  return res.json();
}

async function createDistrict(data: {
  leaid: string;
  name: string;
  stateAbbrev: string;
  cityLocation?: string;
}): Promise<DistrictResult> {
  const res = await fetch("/api/admin/districts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create district" }));
    throw new Error(err.error || "Failed to create district");
  }
  return res.json();
}

async function createAccount(data: {
  name: string;
  accountType: string;
  stateAbbrev?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
}): Promise<DistrictResult> {
  const res = await fetch("/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create account" }));
    throw new Error(err.error || "Failed to create account");
  }
  const result = await res.json();
  return {
    leaid: result.leaid,
    name: result.name,
    stateAbbrev: data.stateAbbrev || data.state || null,
    enrollment: null,
    cityLocation: data.city || null,
  };
}

interface NominatimSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

async function searchAddresses(query: string): Promise<NominatimSuggestion[]> {
  if (!query || query.trim().length < 3) return [];
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    countrycodes: "us",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { "User-Agent": "TerritoryPlanBuilder/1.0" } }
  );
  if (!res.ok) return [];
  return res.json();
}

const UNRESOLVED_REASONS = [
  "Needs Review",
  "Missing District",
  "Remove Child Opp",
  "Organization",
  "University",
  "Private/Charter",
] as const;

async function updateReason(
  id: string,
  reason: string | null,
): Promise<{ id: string; reason: string | null }> {
  const res = await fetch(`/api/admin/unmatched-opportunities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Failed to update reason (${res.status})`);
  }
  return res.json();
}

async function resolveOpportunity(
  id: string,
  resolvedDistrictLeaid: string,
): Promise<{ resolvedCount: number }> {
  const res = await fetch(`/api/admin/unmatched-opportunities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolvedDistrictLeaid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Failed to resolve (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Currency formatter (no decimals per project preference)
// ---------------------------------------------------------------------------

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null || value === "") return "\u2014";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "\u2014";
  return "$" + Math.round(num).toLocaleString();
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return "$" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M";
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return "$" + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + "K";
  }
  return "$" + Math.round(value).toLocaleString();
}

// ---------------------------------------------------------------------------
// Summary data
// ---------------------------------------------------------------------------

interface SummaryData {
  totalCount: number;
  withDistrictId: number;
  withoutDistrictId: number;
  openBookings: number;
  closedWonBookings: number;
  closedLostBookings: number;
}

async function fetchSummary(): Promise<SummaryData> {
  const res = await fetch("/api/admin/unmatched-opportunities/summary");
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

// ---------------------------------------------------------------------------
// KPI Summary Cards
// ---------------------------------------------------------------------------

type CardKey = "unmatched" | "hasDistrictId" | "openPipeline" | "closedWon" | "closedLost";

function SummaryCards({
  data,
  activeCard,
  onCardClick,
}: {
  data: SummaryData | undefined;
  activeCard: CardKey | null;
  onCardClick: (key: CardKey) => void;
}) {
  const cards: { key: CardKey; label: string; value: string; subtitle: string; accent: string }[] = [
    {
      key: "unmatched",
      label: "Unmatched",
      value: data ? data.totalCount.toLocaleString() : "—",
      subtitle: "unresolved opportunities",
      accent: "#403770",
    },
    {
      key: "hasDistrictId",
      label: "Has District ID",
      value: data ? data.withDistrictId.toLocaleString() : "—",
      subtitle: data ? `${data.withoutDistrictId.toLocaleString()} without` : "",
      accent: "#6EA3BE",
    },
    {
      key: "openPipeline",
      label: "Open Pipeline",
      value: data ? formatCompactCurrency(data.openBookings) : "—",
      subtitle: "net booking amount",
      accent: "#FFCF70",
    },
    {
      key: "closedWon",
      label: "Closed Won",
      value: data ? formatCompactCurrency(data.closedWonBookings) : "—",
      subtitle: "net booking amount",
      accent: "#8AA891",
    },
    {
      key: "closedLost",
      label: "Closed Lost",
      value: data ? formatCompactCurrency(data.closedLostBookings) : "—",
      subtitle: "net booking amount",
      accent: "#F37167",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-5">
      {cards.map((card) => {
        const isActive = activeCard === card.key;
        return (
          <button
            key={card.key}
            onClick={() => onCardClick(card.key)}
            className={`text-left bg-white rounded-lg border shadow-sm p-4 relative overflow-hidden transition-all duration-100 ${
              isActive
                ? "border-[#403770] ring-2 ring-[#403770]/20"
                : "border-[#D4CFE2] hover:border-[#C2BBD4] hover:shadow"
            }`}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ backgroundColor: card.accent }}
            />
            <p className="text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
              {card.label}
            </p>
            <p className={`text-xl font-bold tabular-nums ${data ? "text-[#403770]" : "text-[#A69DC0]"}`}>
              {card.value}
            </p>
            {card.subtitle && (
              <p className="text-[11px] text-[#A69DC0]">{card.subtitle}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reason dropdown (inline cell editor)
// ---------------------------------------------------------------------------

function ReasonDropdown({
  value,
  opportunityId,
  onUpdate,
}: {
  value: string | null;
  opportunityId: string;
  onUpdate: (id: string, reason: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen(true);
  };

  // Close on outside click, Escape, or scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleScroll = () => setIsOpen(false);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const handleSelect = (reason: string | null) => {
    onUpdate(opportunityId, reason);
    setIsOpen(false);
  };

  const options: { value: string | null; label: string }[] = [
    { value: null, label: "—" },
    ...UNRESOLVED_REASONS.map((r) => ({ value: r as string | null, label: r })),
  ];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); isOpen ? setIsOpen(false) : openDropdown(); }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full text-xs text-left border border-transparent rounded-lg pl-1.5 pr-6 py-1 bg-transparent hover:border-[#C2BBD4] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent focus:bg-white cursor-pointer transition-colors ${
          value ? "text-[#403770] font-medium" : "text-[#A69DC0]"
        }`}
      >
        {value ?? "—"}
      </button>
      <svg
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69DC0] pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>

      {isOpen && createPortal(
        <ul
          ref={dropdownRef}
          role="listbox"
          className="fixed z-[9999] min-w-[160px] bg-white rounded-xl shadow-xl border border-[#D4CFE2] py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <li
                key={opt.label}
                role="option"
                aria-selected={isSelected}
                onClick={(e) => { e.stopPropagation(); handleSelect(opt.value); }}
                className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#F7F5FA] font-medium text-[#403770]"
                    : opt.value === null
                      ? "text-[#A69DC0] hover:bg-[#EFEDF5]"
                      : "text-[#403770] hover:bg-[#EFEDF5]"
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ resolved }: { resolved: boolean }) {
  if (resolved) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7FFF2] text-[#69B34A] border border-[#8AC670]/30">
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fef1f0] text-[#F37167] border border-[#f58d85]/30">
      Unresolved
    </span>
  );
}

// ---------------------------------------------------------------------------
// District search modal
// ---------------------------------------------------------------------------

function DistrictRow({
  district,
  onSelect,
}: {
  district: DistrictResult;
  onSelect: (d: DistrictResult) => void;
}) {
  return (
    <button
      onClick={() => onSelect(district)}
      className="w-full text-left px-4 py-3 border-b border-[#E2DEEC] last:border-b-0 hover:bg-[#EFEDF5] transition-colors duration-100"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#403770]">
          {district.name}
        </span>
        <span className="text-xs text-[#A69DC0] font-medium tabular-nums flex-shrink-0 ml-3">
          {district.leaid}
        </span>
      </div>
      {district.cityLocation && (
        <div className="text-xs text-[#8A80A8] mt-0.5">
          {district.cityLocation}, {district.stateAbbrev}
        </div>
      )}
      {district.enrollment != null && (
        <div className="text-xs text-[#8A80A8] mt-0.5">
          Enrollment: {district.enrollment.toLocaleString()}
        </div>
      )}
    </button>
  );
}

function SchoolRow({
  school,
  onSelect,
}: {
  school: SchoolResult;
  onSelect: (d: DistrictResult) => void;
}) {
  return (
    <button
      onClick={() =>
        onSelect({
          leaid: school.leaid,
          name: `${school.schoolName} (via school)`,
          stateAbbrev: school.stateAbbrev,
          enrollment: school.enrollment,
          cityLocation: school.city,
        })
      }
      className="w-full text-left px-4 py-3 border-b border-[#E2DEEC] last:border-b-0 hover:bg-[#EFEDF5] transition-colors duration-100"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#403770]">
          {school.schoolName}
        </span>
        <span className="text-xs text-[#A69DC0] font-medium tabular-nums flex-shrink-0 ml-3">
          {school.leaid}
        </span>
      </div>
      <div className="text-xs text-[#8A80A8] mt-0.5">
        {school.city}, {school.stateAbbrev}
      </div>
      {school.enrollment != null && (
        <div className="text-xs text-[#8A80A8] mt-0.5">
          Enrollment: {school.enrollment.toLocaleString()}
        </div>
      )}
    </button>
  );
}

function AddressSearchInput({
  onSelect,
}: {
  onSelect: (suggestion: NominatimSuggestion) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    searchAddresses(debouncedQuery).then((results) => {
      if (!cancelled) {
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setIsSearching(false);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (suggestion: NominatimSuggestion) => {
    setSelectedDisplay(suggestion.display_name);
    setQuery("");
    setIsOpen(false);
    onSelect(suggestion);
  };

  const handleClear = () => {
    setSelectedDisplay(null);
    setQuery("");
    setSuggestions([]);
    onSelect({ display_name: "", lat: "0", lon: "0" });
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-[#544A78] mb-1">
        Address
      </label>
      {selectedDisplay ? (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-[#403770] bg-[#F7F5FA] border border-[#D4CFE2] rounded-lg">
          <svg className="w-3.5 h-3.5 text-[#69B34A] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="truncate flex-1">{selectedDisplay}</span>
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 text-[#A69DC0] hover:text-[#403770] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-[#403770] border-t-transparent" />
            </div>
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedDisplay(null); }}
            onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
            placeholder="Search for an address..."
            className="w-full pl-10 pr-4 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0]"
          />
        </div>
      )}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#D4CFE2] rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="w-full text-left px-3 py-2 text-sm text-[#6E6390] hover:bg-[#EFEDF5] hover:text-[#403770] transition-colors border-b border-[#E2DEEC] last:border-b-0"
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateAccountForm({
  opportunity,
  onCreated,
  onCancel,
}: {
  opportunity: UnmatchedOpportunity;
  onCreated: (district: DistrictResult) => void;
  onCancel: () => void;
}) {
  const [accountType, setAccountType] = useState<AccountTypeValue | "">("");
  const [leaid, setLeaid] = useState("");
  const [name, setName] = useState(opportunity.accountName ?? "");
  const [stateAbbrev, setStateAbbrev] = useState(opportunity.state ?? "");
  const [cityLocation, setCityLocation] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<NominatimSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDistrict = accountType === "district";

  // Parse state from Nominatim display_name (last part before country is typically state)
  const parseStateFromAddress = (displayName: string): string | null => {
    const parts = displayName.split(",").map((p) => p.trim());
    // Nominatim US format: "Street, City, County, State, Zip, United States"
    // Try to find a 2-letter state abbreviation in the parts
    for (const part of parts) {
      const upper = part.toUpperCase();
      if (US_STATES.includes(upper)) return upper;
    }
    return null;
  };

  // Parse city from Nominatim display_name (typically second part)
  const parseCityFromAddress = (displayName: string): string | null => {
    const parts = displayName.split(",").map((p) => p.trim());
    // City is usually the first or second part
    if (parts.length >= 2) return parts[1] || parts[0];
    return parts[0] || null;
  };

  const handleAddressSelect = (suggestion: NominatimSuggestion) => {
    if (!suggestion.display_name) {
      setSelectedAddress(null);
      return;
    }
    setSelectedAddress(suggestion);
    setError(null);
    // Auto-fill state and city from address
    const parsedState = parseStateFromAddress(suggestion.display_name);
    if (parsedState) setStateAbbrev(parsedState);
    const parsedCity = parseCityFromAddress(suggestion.display_name);
    if (parsedCity) setCityLocation(parsedCity);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (isDistrict) {
        return createDistrict({
          leaid,
          name: name.trim(),
          stateAbbrev,
          cityLocation: cityLocation.trim() || undefined,
        });
      }
      return createAccount({
        name: name.trim(),
        accountType: accountType as string,
        stateAbbrev,
        city: cityLocation.trim() || undefined,
        state: stateAbbrev || undefined,
        lat: selectedAddress ? parseFloat(selectedAddress.lat) : undefined,
        lng: selectedAddress ? parseFloat(selectedAddress.lon) : undefined,
      });
    },
    onSuccess: (district) => onCreated(district),
    onError: (err: Error) => setError(err.message),
  });

  const isValid = accountType !== "" &&
    name.trim().length > 0 &&
    stateAbbrev.length === 2 &&
    (isDistrict ? /^\d{7}$/.test(leaid) : true);

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-lg border bg-[#fef1f0] border-[#f58d85]">
          <svg className="w-4 h-4 text-[#c25a52] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          <span className="text-xs font-medium text-[#c25a52]">{error}</span>
        </div>
      )}

      {/* Account Type */}
      <div>
        <label className="block text-xs font-medium text-[#544A78] mb-1">
          Account Type <span className="text-[#F37167]">*</span>
        </label>
        <div className="relative">
          <select
            value={accountType}
            onChange={(e) => { setAccountType(e.target.value as AccountTypeValue | ""); setError(null); }}
            className={`w-full px-3 pr-9 py-2 text-sm border border-[#C2BBD4] rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#403770]/30 focus:border-[#403770] ${
              accountType ? "text-[#403770]" : "text-[#A69DC0]"
            }`}
          >
            <option value="">Select type...</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0] pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Conditional fields based on account type */}
      {accountType && (
        <>
          {/* District: manual NCES LEAID */}
          {isDistrict && (
            <div>
              <label className="block text-xs font-medium text-[#544A78] mb-1">
                NCES LEAID <span className="text-[#F37167]">*</span>
              </label>
              <input
                type="text"
                value={leaid}
                onChange={(e) => { setLeaid(e.target.value.replace(/\D/g, "").slice(0, 7)); setError(null); }}
                placeholder="7-digit ID (e.g. 0100005)"
                className="w-full px-3 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0] tabular-nums"
              />
            </div>
          )}

          {/* Non-district: auto-generated ID note */}
          {!isDistrict && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg">
              <svg className="w-4 h-4 text-[#6EA3BE] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-[#8A80A8]">
                ID will be auto-generated (M000XXX format)
              </span>
            </div>
          )}

          {/* Account Name */}
          <div>
            <label className="block text-xs font-medium text-[#544A78] mb-1">
              {isDistrict ? "District Name" : "Account Name"} <span className="text-[#F37167]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder={isDistrict ? "e.g. Springfield Public Schools" : "e.g. Acme Learning Corp"}
              className="w-full px-3 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0]"
            />
          </div>

          {/* Address Search */}
          <AddressSearchInput onSelect={handleAddressSelect} />

          {/* State + City */}
          <div className="flex gap-3">
            <div className="w-28">
              <label className="block text-xs font-medium text-[#544A78] mb-1">
                State <span className="text-[#F37167]">*</span>
              </label>
              <div className="relative">
                <select
                  value={stateAbbrev}
                  onChange={(e) => { setStateAbbrev(e.target.value); setError(null); }}
                  className={`w-full px-3 pr-9 py-2 text-sm border border-[#C2BBD4] rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent ${
                    stateAbbrev ? "text-[#403770]" : "text-[#A69DC0]"
                  }`}
                >
                  <option value="">—</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <svg
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0] pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#544A78] mb-1">
                City
              </label>
              <input
                type="text"
                value={cityLocation}
                onChange={(e) => setCityLocation(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0]"
              />
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!isValid || createMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {createMutation.isPending ? "Creating..." : "Create & Resolve"}
        </button>
      </div>
    </div>
  );
}

function DistrictSearchModal({
  opportunity,
  onSelect,
  onClose,
}: {
  opportunity: UnmatchedOpportunity;
  onSelect: (district: DistrictResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showCreate) inputRef.current?.focus();
  }, [showCreate]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Fuzzy suggestions based on opportunity name + state
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["district-suggestions", opportunity.accountName, opportunity.state],
    queryFn: () => fetchSuggestions(opportunity.accountName ?? "", opportunity.state),
    enabled: !!opportunity.accountName,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["district-search", debouncedQuery],
    queryFn: () => searchDistricts(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const { data: schoolResults, isLoading: schoolsLoading } = useQuery({
    queryKey: ["school-search", debouncedQuery],
    queryFn: () => searchSchools(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const hasSuggestions = (suggestions?.items.length ?? 0) > 0;
  const isSearching = debouncedQuery.length >= 2;
  const hasSchoolResults = (schoolResults?.schools.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#403770]">
              {showCreate ? "Create New Account" : "Resolve to District"}
            </h3>
            <p className="text-sm text-[#8A80A8] mt-1">
              {opportunity.accountName}
              {opportunity.state && <span className="ml-1">({opportunity.state})</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {showCreate ? (
          <CreateAccountForm
            opportunity={opportunity}
            onCreated={onSelect}
            onCancel={() => setShowCreate(false)}
          />
        ) : (
          <>
            {/* Suggestions section */}
            {!isSearching && (
              <div className="mb-3">
                {suggestionsLoading && (
                  <div className="px-4 py-4 text-center border border-[#E2DEEC] rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#403770] border-t-transparent mx-auto mb-2" />
                    <span className="text-xs text-[#8A80A8]">Finding potential matches...</span>
                  </div>
                )}
                {!suggestionsLoading && hasSuggestions && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-[#403770] uppercase tracking-wide">
                        Suggested Matches
                      </span>
                      <span className="text-[10px] text-[#8A80A8] bg-[#F5F3FA] px-1.5 py-0.5 rounded">
                        {suggestions!.items.length} found
                      </span>
                    </div>
                    <div className="border border-[#D6D0E8] rounded-lg max-h-48 overflow-y-auto bg-[#FDFCFF]">
                      {suggestions!.items.map((district) => (
                        <DistrictRow key={district.leaid} district={district} onSelect={onSelect} />
                      ))}
                    </div>
                  </div>
                )}
                {!suggestionsLoading && !hasSuggestions && opportunity.accountName && (
                  <div className="px-4 py-3 text-center text-xs text-[#8A80A8] border border-[#E2DEEC] rounded-lg">
                    No automatic matches found — try searching below.
                  </div>
                )}
              </div>
            )}

            {/* Divider + search label */}
            {!isSearching && hasSuggestions && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-[#E2DEEC]" />
                <span className="text-[10px] text-[#A69DC0] uppercase tracking-wide">or search manually</span>
                <div className="flex-1 h-px bg-[#E2DEEC]" />
              </div>
            )}

            <div className="relative mb-3">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
                placeholder="Search districts or schools by name..."
                className="w-full pl-10 pr-4 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0]"
              />
            </div>

            {/* Search results */}
            {isSearching && (
              <div className="max-h-64 overflow-y-auto border border-[#E2DEEC] rounded-lg">
                {/* District results */}
                {!searchLoading && (searchResults?.items.length ?? 0) > 0 && (
                  <>
                    <div className="px-4 py-1.5 bg-[#F5F3FA] border-b border-[#E2DEEC] flex items-center gap-2 sticky top-0">
                      <span className="text-[10px] font-semibold text-[#403770] uppercase tracking-wide">Districts</span>
                      <span className="text-[10px] text-[#8A80A8] bg-white px-1.5 py-0.5 rounded">
                        {searchResults!.items.length}
                      </span>
                    </div>
                    {searchResults!.items.map((district) => (
                      <DistrictRow key={district.leaid} district={district} onSelect={onSelect} />
                    ))}
                  </>
                )}

                {/* School results */}
                {!schoolsLoading && hasSchoolResults && (
                  <>
                    <div className="px-4 py-1.5 bg-[#F5F3FA] border-b border-[#E2DEEC] flex items-center gap-2 sticky top-0">
                      <span className="text-[10px] font-semibold text-[#403770] uppercase tracking-wide">Schools</span>
                      <span className="text-[10px] text-[#8A80A8] bg-white px-1.5 py-0.5 rounded">
                        {schoolResults!.schools.length}
                      </span>
                    </div>
                    {schoolResults!.schools.map((school) => (
                      <SchoolRow key={school.ncessch} school={school} onSelect={onSelect} />
                    ))}
                  </>
                )}

                {/* Loading spinner when either query is still loading */}
                {(searchLoading || schoolsLoading) && (
                  <div className="px-4 py-4 text-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#403770] border-t-transparent mx-auto" />
                  </div>
                )}

                {/* Empty state when both queries done and no results */}
                {!searchLoading && !schoolsLoading && (searchResults?.items.length ?? 0) === 0 && !hasSchoolResults && (
                  <div className="px-4 py-6 text-center text-sm text-[#8A80A8]">
                    No districts or schools found
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#6EA3BE] hover:text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create new account
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UnmatchedOpportunitiesPage() {
  const queryClient = useQueryClient();

  // Summary stats for KPI cards
  const { data: summary } = useQuery({
    queryKey: ["unmatched-opportunities-summary"],
    queryFn: fetchSummary,
    staleTime: 30 * 1000,
  });

  // Fetch distinct stage/reason values for filter dropdowns
  const { data: facets } = useQuery({
    queryKey: ["unmatched-opportunities-facets"],
    queryFn: fetchFacets,
    staleTime: 5 * 60 * 1000,
  });

  // Hydrate column defs with facet values
  const hydratedColumns = useMemo(() => {
    if (!facets) return unmatchedOpportunityColumns;
    return unmatchedOpportunityColumns.map((col) => {
      if (col.key === "stage") return { ...col, enumValues: facets.stages };
      if (col.key === "reason") return { ...col, enumValues: facets.reasons };
      return col;
    });
  }, [facets]);

  // DataGrid state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    unmatchedOpportunityColumns.filter((c) => c.isDefault).map((c) => c.key)
  );
  const [sorts, setSorts] = useState<SortRule[]>([
    { column: "netBookingAmount", direction: "desc" },
  ]);
  const [page, setPage] = useState(1);
  // Start with "unresolved" filter active (same default as current page)
  const [filters, setFilters] = useState<FilterRule[]>([
    { column: "resolved", operator: "is_false", value: false },
  ]);

  const [activeCard, setActiveCard] = useState<CardKey | null>(null);
  const [resolvingOpp, setResolvingOpp] = useState<UnmatchedOpportunity | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Sort handler (single-sort, 3-click cycle: asc -> desc -> clear)
  const handleSort = useCallback((column: string) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.column === column);
      if (!existing) return [{ column, direction: "asc" as const }];
      if (existing.direction === "asc") return [{ column, direction: "desc" as const }];
      return [];
    });
    setPage(1);
  }, []);

  // Card click handler — toggle card filter, reset page
  const handleCardClick = useCallback((key: CardKey) => {
    setActiveCard((prev) => (prev === key ? null : key));
    setPage(1);
  }, []);

  // Derive API params from FilterRule[] array
  const resolvedFilter = filters.find((f) => f.column === "resolved");
  const resolvedParam = resolvedFilter
    ? resolvedFilter.operator === "is_true" ? "true" : "false"
    : undefined;
  const schoolYrFilter = filters.find((f) => f.column === "schoolYr" && f.operator === "eq");
  const stateFilterRule = filters.find((f) => f.column === "state" && f.operator === "eq");
  const stageFilter = filters.find((f) => f.column === "stage" && f.operator === "eq");
  const reasonFilter = filters.find((f) => f.column === "reason" && f.operator === "eq");
  const searchFilter = filters.find((f) => f.column === "name" && f.operator === "contains");

  // Derive card-based API params
  const cardParams: { has_district_id?: string; stage_group?: string } = {};
  if (activeCard === "hasDistrictId") cardParams.has_district_id = "true";
  if (activeCard === "openPipeline") cardParams.stage_group = "open";
  if (activeCard === "closedWon") cardParams.stage_group = "closed_won";
  if (activeCard === "closedLost") cardParams.stage_group = "closed_lost";

  const sortRule = sorts[0];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["unmatched-opportunities", filters, sorts, page, activeCard],
    queryFn: () =>
      fetchOpportunities({
        resolved: resolvedParam,
        school_yr: schoolYrFilter ? String(schoolYrFilter.value) : undefined,
        state: stateFilterRule ? String(stateFilterRule.value) : undefined,
        stage: stageFilter ? String(stageFilter.value) : undefined,
        reason: reasonFilter ? String(reasonFilter.value) : undefined,
        search: searchFilter ? String(searchFilter.value) : undefined,
        ...cardParams,
        sort_by: sortRule?.column,
        sort_dir: sortRule?.direction,
        page,
        page_size: 50,
      }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, leaid }: { id: string; leaid: string; districtName: string }) =>
      resolveOpportunity(id, leaid),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities-summary"] });
      const count = data.resolvedCount ?? 1;
      const countLabel = count > 1 ? `${count} opportunities` : "1 opportunity";
      setToast(`Resolved ${countLabel} to ${variables.districtName} (${variables.leaid})`);
      setResolvingOpp(null);
    },
    onError: (error) => {
      const msg = error.message?.includes("not found")
        ? "District not found in system — use Create New District to add it first"
        : "Failed to resolve opportunity";
      setToast(msg);
      setResolvingOpp(null);
    },
  });

  const reasonMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
      updateReason(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities-facets"] });
    },
    onError: (error) => {
      setToast(error.message || "Failed to update reason");
    },
  });

  const handleReasonUpdate = useCallback(
    (id: string, reason: string | null) => {
      reasonMutation.mutate({ id, reason });
    },
    [reasonMutation]
  );

  const handleResolve = useCallback(
    (district: DistrictResult) => {
      if (!resolvingOpp) return;
      resolveMutation.mutate({
        id: resolvingOpp.id,
        leaid: district.leaid,
        districtName: district.name,
      });
    },
    [resolvingOpp, resolveMutation]
  );

  // Cell renderers
  const cellRenderers = useMemo<Record<string, CellRendererFn>>(() => ({
    name: ({ value, row }) => {
      const name = value as string | null;
      const id = row.id as string;
      if (!name) return <span className="text-[#A69DC0]">&mdash;</span>;
      return (
        <a
          href={`https://lms.fullmindlearning.com/opportunities/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#6EA3BE] hover:text-[#403770] hover:underline transition-colors"
          title="Open in LMS"
        >
          {name}
        </a>
      );
    },
    accountLmsId: ({ value }) => {
      const lmsId = value as string | null;
      if (!lmsId) return <span className="text-[#A69DC0]">&mdash;</span>;
      return (
        <a
          href={`https://lms.fullmindlearning.com/districts/${lmsId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#6EA3BE] hover:text-[#403770] hover:underline transition-colors tabular-nums"
          title="Open in LMS"
        >
          {lmsId}
        </a>
      );
    },
    resolvedDistrictLeaid: ({ value }) => {
      const leaid = value as string | null;
      if (!leaid) return <span className="text-[#A69DC0]">&mdash;</span>;
      return <span className="tabular-nums font-medium text-[#6E6390]">{leaid}</span>;
    },
    resolved: ({ value }) => {
      const isResolved = value as boolean;
      return <StatusBadge resolved={isResolved} />;
    },
    reason: ({ value, row }) => (
      <ReasonDropdown
        value={value as string | null}
        opportunityId={row.id as string}
        onUpdate={handleReasonUpdate}
      />
    ),
    netBookingAmount: ({ value }) => (
      <span className="tabular-nums font-medium">{formatCurrency(value as string)}</span>
    ),
  }), [handleReasonUpdate]);

  const renderRowAction = useCallback((row: Record<string, unknown>) => {
    const isResolved = row.resolved as boolean;
    if (isResolved) return null;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setResolvingOpp({
            id: row.id as string,
            name: row.name as string | null,
            accountName: row.accountName as string | null,
            state: row.state as string | null,
            schoolYr: row.schoolYr as string | null,
            stage: row.stage as string | null,
            netBookingAmount: row.netBookingAmount as string | null,
            reason: row.reason as string | null,
            resolved: row.resolved as boolean,
            resolvedDistrictLeaid: row.resolvedDistrictLeaid as string | null,
          });
        }}
        className="px-2.5 py-1 text-xs font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors"
      >
        Resolve
      </button>
    );
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header + Summary */}
      <div className="mb-3 shrink-0">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-[#403770]">Unmatched Opportunities</h1>
            <p className="text-sm text-[#8A80A8] mt-0.5">
              Opportunities that could not be automatically matched to a district.
              {data?.pagination && (
                <span className="ml-1 font-medium text-[#6E6390]">
                  {data.pagination.total} showing
                </span>
              )}
            </p>
          </div>
        </div>
        <SummaryCards data={summary} activeCard={activeCard} onCardClick={handleCardClick} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap shrink-0">
        <AdminFilterBar
          columnDefs={hydratedColumns}
          filters={filters}
          onAddFilter={(f) => { setFilters((prev) => [...prev, f]); setPage(1); }}
          onRemoveFilter={(i) => { setFilters((prev) => prev.filter((_, idx) => idx !== i)); setPage(1); }}
          onUpdateFilter={(i, f) => { setFilters((prev) => prev.map((existing, idx) => idx === i ? f : existing)); setPage(1); }}
        />
        <div className="ml-auto">
          <AdminColumnPicker
            columnDefs={hydratedColumns}
            visibleColumns={visibleColumns}
            onColumnsChange={setVisibleColumns}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col">
      <DataGrid
        data={(data?.items ?? []) as unknown as Record<string, unknown>[]}
        columnDefs={hydratedColumns}
        entityType="opportunities"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        visibleColumns={visibleColumns}
        onColumnsChange={setVisibleColumns}
        sorts={sorts}
        onSort={handleSort}
        hasActiveFilters={filters.length > 0}
        onClearFilters={() => { setFilters([]); setPage(1); }}
        pagination={data?.pagination}
        onPageChange={setPage}
        cellRenderers={cellRenderers}
        renderRowAction={renderRowAction}
      />
      </div>

      {/* Resolution modal */}
      {resolvingOpp && (
        <DistrictSearchModal
          opportunity={resolvingOpp}
          onSelect={handleResolve}
          onClose={() => setResolvingOpp(null)}
        />
      )}

      {/* Success toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg border bg-[#F7FFF2] border-[#8AC670] shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <svg className="w-4 h-4 text-[#69B34A] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-[#5f665b]">{toast}</span>
        </div>
      )}
    </div>
  );
}
