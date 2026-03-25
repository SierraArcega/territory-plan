"use client";

import type { ReportConfig, EntitySchema, FilterDef } from "../lib/types";
import SourceSelector from "./SourceSelector";
import ColumnPicker from "./ColumnPicker";
import FilterBuilder from "./FilterBuilder";

interface ReportConfigBarProps {
  config: ReportConfig;
  onConfigChange: (config: ReportConfig) => void;
  entities: EntitySchema[];
  isSchemaLoading: boolean;
  reportName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onShare: () => void;
  onExport: () => void;
  isSaving: boolean;
  isExporting: boolean;
  canSave: boolean;
  canShare: boolean;
}

export default function ReportConfigBar({
  config,
  onConfigChange,
  entities,
  isSchemaLoading,
  reportName,
  onNameChange,
  onSave,
  onShare,
  onExport,
  isSaving,
  isExporting,
  canSave,
  canShare,
}: ReportConfigBarProps) {
  const currentEntity = entities.find((e) => e.name === config.source);
  const hasSource = config.source.length > 0;
  const hasColumns = config.columns.length > 0;

  const handleSourceChange = (source: string) => {
    // Reset columns and filters when source changes
    onConfigChange({
      ...config,
      source,
      columns: [],
      filters: [],
      sorts: [],
      page: 1,
    });
  };

  const handleColumnsChange = (columns: string[]) => {
    onConfigChange({ ...config, columns, page: 1 });
  };

  const handleFiltersChange = (filters: FilterDef[]) => {
    onConfigChange({ ...config, filters, page: 1 });
  };

  return (
    <div className="border-b border-[#D4CFE2] bg-white">
      {/* Row 1: Source + Name + Actions */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[#E2DEEC]">
        <SourceSelector
          entities={entities}
          value={config.source}
          onChange={handleSourceChange}
          isLoading={isSchemaLoading}
        />

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={reportName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Untitled Report"
            className="w-full text-sm font-semibold text-[#403770] bg-transparent border-none focus:outline-none placeholder:text-[#A69DC0] truncate"
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onSave}
            disabled={!canSave || isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#403770] text-white text-xs font-medium rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
            )}
            Save
          </button>

          <button
            onClick={onShare}
            disabled={!canShare}
            title={!canShare ? "Save the report first to share it" : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#D4CFE2] text-[#403770] text-xs font-medium rounded-lg hover:bg-[#EFEDF5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share
          </button>

          <button
            onClick={onExport}
            disabled={!hasColumns || isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#D4CFE2] text-[#403770] text-xs font-medium rounded-lg hover:bg-[#EFEDF5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <div className="w-3 h-3 border-2 border-[#403770]/30 border-t-[#403770] rounded-full animate-spin" />
            ) : (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            )}
            Export
          </button>
        </div>
      </div>

      {/* Row 2: Columns */}
      <div className="px-4 py-2 border-b border-[#E2DEEC]">
        <ColumnPicker
          availableColumns={currentEntity?.columns ?? []}
          selectedColumns={config.columns}
          onChange={handleColumnsChange}
          disabled={!hasSource}
        />
      </div>

      {/* Row 3: Filters */}
      <div className="px-4 py-2">
        <FilterBuilder
          availableColumns={currentEntity?.columns ?? []}
          filters={config.filters}
          onChange={handleFiltersChange}
          disabled={!hasSource}
        />
      </div>
    </div>
  );
}
