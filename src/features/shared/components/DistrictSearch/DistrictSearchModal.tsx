"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { US_STATES } from "@/lib/states";
import { ACCOUNT_TYPES } from "@/features/shared/types/account-types";
import type { AccountTypeValue } from "@/features/shared/types/account-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistrictResult {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  cityLocation: string | null;
}

export interface SchoolResult {
  ncessch: string;
  leaid: string;
  schoolName: string;
  city: string;
  stateAbbrev: string;
  enrollment: number | null;
}

export interface NominatimSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export interface DistrictSearchModalProps {
  // Display-only label shown in the header (e.g., agency name, or "5 agencies").
  subjectName: string;
  subjectState: string | null;
  subjectSubtitle?: string;
  // Optional fuzzy-match input for the suggestions endpoint. Defaults to subjectName.
  // Pass an empty string to disable suggestions (e.g., bulk multi-agency case where
  // there's no single name to match against).
  searchHint?: string;
  // Optional pre-fill for the "Create new district" form's name field. Defaults to
  // subjectName. Pass an empty string for bulk cases where no per-row name applies.
  defaultDistrictName?: string;
  onSelect: (district: DistrictResult) => void;
  onClose: () => void;
  headerTitle?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper components
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
  defaultName,
  defaultStateAbbrev,
  onCreated,
  onCancel,
}: {
  defaultName: string;
  defaultStateAbbrev: string | null;
  onCreated: (district: DistrictResult) => void;
  onCancel: () => void;
}) {
  const [accountType, setAccountType] = useState<AccountTypeValue | "">("");
  const [leaid, setLeaid] = useState("");
  const [name, setName] = useState(defaultName);
  const [stateAbbrev, setStateAbbrev] = useState(defaultStateAbbrev ?? "");
  const [cityLocation, setCityLocation] = useState("");
  const [selectedAddress, setSelectedAddress] = useState<NominatimSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDistrict = accountType === "district";

  const parseStateFromAddress = (displayName: string): string | null => {
    const parts = displayName.split(",").map((p) => p.trim());
    for (const part of parts) {
      const upper = part.toUpperCase();
      if (US_STATES.includes(upper)) return upper;
    }
    return null;
  };

  const parseCityFromAddress = (displayName: string): string | null => {
    const parts = displayName.split(",").map((p) => p.trim());
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function DistrictSearchModal({
  subjectName,
  subjectState,
  subjectSubtitle,
  searchHint,
  defaultDistrictName,
  onSelect,
  onClose,
  headerTitle,
}: DistrictSearchModalProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // searchHint controls fuzzy match; if explicitly empty, suggestions are skipped.
  const effectiveSearchHint = searchHint ?? subjectName;
  const effectiveCreateDefaultName = defaultDistrictName ?? subjectName;

  useEffect(() => {
    if (!showCreate) inputRef.current?.focus();
  }, [showCreate]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["district-suggestions", effectiveSearchHint, subjectState],
    queryFn: () => fetchSuggestions(effectiveSearchHint, subjectState),
    enabled: !!effectiveSearchHint,
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
              {showCreate ? "Create New Account" : (headerTitle ?? "Resolve to District")}
            </h3>
            <p className="text-sm text-[#8A80A8] mt-1">
              {subjectName}
              {subjectState && <span className="ml-1">({subjectState})</span>}
            </p>
            {subjectSubtitle && (
              <p className="text-xs text-[#A69DC0] mt-0.5">{subjectSubtitle}</p>
            )}
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
            defaultName={effectiveCreateDefaultName}
            defaultStateAbbrev={subjectState}
            onCreated={onSelect}
            onCancel={() => setShowCreate(false)}
          />
        ) : (
          <>
            {/* Suggestions section — only when there is a single subject to fuzzy-match. */}
            {!isSearching && effectiveSearchHint && (
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
                {!suggestionsLoading && !hasSuggestions && subjectName && (
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
