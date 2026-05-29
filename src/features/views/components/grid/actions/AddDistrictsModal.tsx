"use client";

import { useState, useRef, useCallback } from "react";
import { X, Search, Loader2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface DistrictHit {
  leaid: string;
  name: string;
  stateAbbrev: string;
}

interface AddDistrictsModalProps {
  planId: string;
  open: boolean;
  onClose: () => void;
}

export function AddDistrictsModal({
  planId,
  open,
  onClose,
}: AddDistrictsModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DistrictHit[]>([]);
  const [loading, setLoading] = useState(false);
  /** leaids that have been successfully added this session. */
  const [added, setAdded] = useState<Set<string>>(new Set());
  /** leaids whose POST is currently in-flight. */
  const [adding, setAdding] = useState<Set<string>>(new Set());
  /** leaids whose POST returned an error this session. */
  const [rowErrors, setRowErrors] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/districts/search?q=${encodeURIComponent(q)}`,
        );
        const data = (await res.json()) as { items?: DistrictHit[] };
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleAdd = useCallback(
    async (leaid: string) => {
      setAdding((prev) => new Set([...prev, leaid]));
      try {
        const res = await fetch(`/api/territory-plans/${planId}/districts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leaids: [leaid] }),
        });
        if (res.ok) {
          setAdded((prev) => new Set([...prev, leaid]));
        } else {
          setRowErrors((prev) => new Set([...prev, leaid]));
        }
      } catch {
        setRowErrors((prev) => new Set([...prev, leaid]));
      } finally {
        setAdding((prev) => {
          const next = new Set(prev);
          next.delete(leaid);
          return next;
        });
      }
    },
    [planId],
  );

  const handleClose = useCallback(() => {
    // Refresh the districts table if anything was added this session.
    if (added.size > 0) {
      queryClient.invalidateQueries({ queryKey: ["views", "data"] });
    }
    setQuery("");
    setResults([]);
    setAdded(new Set());
    setAdding(new Set());
    setRowErrors(new Set());
    onClose();
  }, [added, queryClient, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative flex w-full max-w-md flex-col rounded-2xl border border-[#E2DEEC] bg-white shadow-[0_16px_48px_rgba(64,55,112,0.2)]"
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EFEDF5] px-4 py-3.5">
          <h2 className="text-[15px] font-semibold text-[#403770]">
            Add districts to plan
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="text-[#8A80A8] transition-colors hover:text-[#403770]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="border-b border-[#EFEDF5] px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A69DC0]" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or state…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="w-full rounded-lg border border-[#D4CFE2] bg-white py-2 pl-8 pr-3 text-[13px] text-[#403770] placeholder-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#D4CFE2]"
            />
          </div>
        </div>

        {/* Results */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-4 py-6 text-center text-[12px] text-[#8A80A8]">
              Type at least 2 characters
            </div>
          ) : loading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="animate-spin text-[#8A80A8]" size={16} />
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-[#8A80A8]">
              No matches
            </div>
          ) : (
            results.map((d) => {
              const isAdded = added.has(d.leaid);
              const isAdding = adding.has(d.leaid);
              const hasError = rowErrors.has(d.leaid);
              return (
                <div
                  key={d.leaid}
                  className="flex items-center justify-between border-b border-[#EFEDF5] px-4 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[#403770]">
                      {d.name}
                    </p>
                    <p className="text-[11px] text-[#8A80A8]">{d.stateAbbrev}</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1.5">
                    {hasError && (
                      <AlertCircle
                        size={14}
                        className="text-red-500"
                        title="Failed to add"
                      />
                    )}
                    <button
                      type="button"
                      aria-label={isAdded ? `✓ Added` : `+ Add`}
                      disabled={isAdded || isAdding}
                      onClick={() => handleAdd(d.leaid)}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        isAdded
                          ? "cursor-default bg-[#EFEDF5] text-[#403770]"
                          : isAdding
                            ? "cursor-wait bg-[#EFEDF5] text-[#8A80A8]"
                            : "bg-[#403770] text-white hover:bg-[#322a5a]"
                      }`}
                    >
                      {isAdded ? "✓ Added" : isAdding ? "Adding…" : "+ Add"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
