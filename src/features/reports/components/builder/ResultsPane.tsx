"use client";

import { Code2, Download } from "lucide-react";
import { useState } from "react";
import { ResultsTable } from "../ResultsTable";
import { SqlPreviewModal } from "../SqlPreviewModal";
import { downloadCsv, rowsToCsv, slugifyForFilename } from "../../lib/csv";
import { ChipStrip } from "./ChipStrip";
import { SaveButton, type SessionMode } from "./SaveButton";
import type { BuilderVersion } from "./types";

interface Props {
  version: BuilderVersion | null;
  sessionMode: SessionMode;
  savedReportTitle: string;
  savedReportDescription: string;
  saveBusy: boolean;
  onSaveNew: (title: string, description: string) => void;
  onUpdateSavedReport: () => void;
  onEditDetails: (title: string, description: string) => void;
  onDelete: () => void;
}

/**
 * Slice 4 minimal results pane: header (eyebrow + title + View SQL + Export
 * CSV) + existing ResultsTable. Slice 5 layers in the chip strip and split
 * Save button; slice 6 wires the save modal.
 */
export function ResultsPane({
  version,
  sessionMode,
  savedReportTitle,
  savedReportDescription,
  saveBusy,
  onSaveNew,
  onUpdateSavedReport,
  onEditDetails,
  onDelete,
}: Props) {
  const [sqlOpen, setSqlOpen] = useState(false);
  const isFromSavedReport = sessionMode !== "fresh";
  const hasRefinements = sessionMode === "loaded-refined";

  if (!version) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#FFFCFA] px-6">
        <div className="max-w-[420px] rounded-xl border border-dashed border-[#D4CFE2] bg-white px-6 py-8 text-center">
          <div className="text-[13px] font-semibold text-[#403770]">No result yet</div>
          <div className="mt-1 text-[12px] leading-relaxed text-[#8A80A8]">
            Submit a question on the left and Claude&apos;s first result lands here. Each
            refinement becomes a new version you can flip between.
          </div>
        </div>
      </div>
    );
  }

  const handleExport = () => {
    const csv = rowsToCsv(version.columns, version.rows);
    downloadCsv(slugifyForFilename(version.summary.source), csv);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#FFFCFA]" style={{ flex: 1.6 }}>
      <div className="flex shrink-0 items-start gap-3 px-[18px] pt-3.5 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8]">
            <span className="whitespace-nowrap">
              Result · v{version.n} · {version.rowCount.toLocaleString()} rows
            </span>
            {isFromSavedReport && (
              <>
                <span className="text-[#D4CFE2]">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#544A78]">
                  <span className="whitespace-nowrap">From saved report</span>
                  {hasRefinements && (
                    <span className="font-medium text-[#A69DC0]">· refined</span>
                  )}
                </span>
              </>
            )}
          </div>
          <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-bold tracking-[-0.01em] text-[#403770]">
            {version.summary.source}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <HeaderButton onClick={() => setSqlOpen(true)} icon={<Code2 size={13} />}>
            View SQL
          </HeaderButton>
          <HeaderButton
            onClick={handleExport}
            icon={<Download size={13} />}
            disabled={version.rows.length === 0}
          >
            Export CSV
          </HeaderButton>
          <SaveButton
            sessionMode={sessionMode}
            initialTitle={savedReportTitle || version.summary.source}
            initialDescription={savedReportDescription}
            busy={saveBusy}
            onSaveNew={onSaveNew}
            onUpdateSavedReport={onUpdateSavedReport}
            onEditDetails={onEditDetails}
            onDelete={onDelete}
          />
        </div>
      </div>

      <ChipStrip summary={version.summary} />

      <div className="min-h-0 flex-1 px-[18px] pb-[18px]">
        <ResultsTable columns={version.columns} rows={version.rows} />
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[#E2DEEC] bg-[#FFFCFA] px-[18px] py-1.5 text-[11px] text-[#8A80A8]">
        <span className="whitespace-nowrap">
          {version.rowCount.toLocaleString()} rows · {version.columns.length} columns
        </span>
        <span className="tabular-nums text-[#A69DC0]">
          {(version.executionTimeMs / 1000).toFixed(1)}s
        </span>
      </div>

      {sqlOpen && (
        <SqlPreviewModal
          sql={version.sql}
          source={version.summary.source}
          onClose={() => setSqlOpen(false)}
        />
      )}
    </div>
  );
}

function HeaderButton({
  onClick,
  icon,
  children,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#403770] transition-colors hover:bg-[#F7F5FA] disabled:cursor-not-allowed disabled:text-[#A69DC0]"
    >
      {icon}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}
