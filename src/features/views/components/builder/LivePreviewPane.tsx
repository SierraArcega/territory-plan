"use client";

/**
 * LivePreviewPane — sticky 280px right column showing the current spec's
 * match count + 3 sample rows. Subscribes to `useListPreview()` which already
 * debounces 300ms internally (per Phase B).
 *
 * Layout:
 *   ┌─ Live preview ───────────────────┐
 *   │ 28px tabular-nums count    matches│
 *   │ Scoped to {ref name}            │  (only when scope=reference)
 *   ├──────────────────────────────────┤
 *   │ Sample item 1                    │
 *   │ Sample item 2                    │
 *   │ Sample item 3                    │
 *   │   + N more                       │
 *   └──────────────────────────────────┘
 *
 * States:
 *   - loading → spinner over the count + skeleton rows
 *   - error   → muted "Couldn't preview — check filters"
 */
import { Loader2 } from "lucide-react";
import type {
  SavedListSource,
  ScopeMode,
  ScopeRefKind,
} from "@/lib/saved-views/filter-tree";
import {
  useListPreview,
  type PreviewSpec,
} from "../../lib/queries";

interface LivePreviewPaneProps {
  spec: PreviewSpec | null;
  source: SavedListSource;
  scopeMode: ScopeMode;
  scopeRefName: string | null;
}

export default function LivePreviewPane({
  spec,
  source,
  scopeMode,
  scopeRefName,
}: LivePreviewPaneProps) {
  const previewQ = useListPreview(spec);

  const count = previewQ.data?.count ?? null;
  const sample = previewQ.data?.sample ?? [];
  const more = count != null ? Math.max(0, count - sample.length) : 0;

  return (
    <aside
      aria-label="Live preview"
      className="bg-[#FFFCFA] border-l border-[#E2DEEC] px-5 py-5 flex flex-col gap-3 sticky top-0 self-start min-h-full"
      style={{ height: "100%" }}
    >
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
          Live preview
        </div>
        <div className="flex items-baseline gap-1.5 mt-1">
          {previewQ.isFetching ? (
            <Loader2
              className="w-6 h-6 text-[#A69DC0] animate-spin"
              aria-hidden
              strokeWidth={2.25}
            />
          ) : (
            <span className="text-[28px] font-bold text-[#403770] tracking-tight tabular-nums leading-none">
              {count == null ? "—" : count.toLocaleString()}
            </span>
          )}
          <span className="text-xs text-[#8A80A8] font-medium whitespace-nowrap">
            {source} {count === 1 ? "match" : "matches"}
          </span>
        </div>
        {scopeMode === "reference" && scopeRefName && (
          <div className="text-[11px] text-[#8A80A8] mt-1.5 px-2 py-1.5 bg-white border border-[#E2DEEC] rounded-md">
            Scoped to{" "}
            <strong className="text-[#403770] font-semibold whitespace-nowrap">
              {scopeRefName}
            </strong>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 flex-1 overflow-auto" data-testid="sample-list">
        {previewQ.isError ? (
          <div className="text-[11px] text-[#8A80A8] text-center px-2 py-3">
            Couldn&apos;t preview — check filters
          </div>
        ) : previewQ.isFetching && sample.length === 0 ? (
          // Skeleton rows while initial load happens.
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="px-2.5 py-2 bg-white border border-[#E2DEEC] rounded-md"
              aria-hidden
            >
              <div className="h-3 w-2/3 rounded bg-[#F7F5FA] animate-pulse" />
              <div className="h-2 w-1/2 mt-1.5 rounded bg-[#F7F5FA] animate-pulse" />
            </div>
          ))
        ) : sample.length === 0 ? (
          <div className="text-[11px] text-[#A69DC0] text-center px-2 py-3">
            No sample to show
          </div>
        ) : (
          <>
            {sample.map((it, i) => (
              <div
                key={String(it.id ?? i)}
                className="px-2.5 py-2 bg-white border border-[#E2DEEC] rounded-md"
              >
                <div className="text-xs font-semibold text-[#403770] truncate">
                  {it.primaryLabel ?? "—"}
                </div>
                {it.secondaryLabel && (
                  <div className="text-[11px] text-[#8A80A8] mt-0.5 truncate">
                    {it.secondaryLabel}
                  </div>
                )}
                {it.meta != null && (
                  <div className="text-[11px] text-[#544A78] font-medium mt-0.5 tabular-nums truncate">
                    {String(it.meta)}
                  </div>
                )}
              </div>
            ))}
            {more > 0 && (
              <div className="text-[11px] text-[#A69DC0] text-center px-2 py-2 tabular-nums">
                + {more.toLocaleString()} more
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
