"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  useReportSchema,
  useReportQuery,
  useSavedReport,
  useSaveReportMutation,
  useExportReport,
} from "../lib/queries";
import type { ReportConfig, FilterDef, SortDef } from "../lib/types";
import type { ColumnDef } from "@/features/shared/components/DataGrid/types";
import { DataGrid } from "@/features/shared/components/DataGrid/DataGrid";
import { columnKeyToLabel } from "../lib/field-maps";
import ReportConfigBar from "./ReportConfigBar";
import ShareModal from "./ShareModal";

interface ReportBuilderProps {
  reportId: string | null; // null = new report
  onBack: () => void;
}

const DEFAULT_CONFIG: ReportConfig = {
  source: "",
  columns: [],
  filters: [],
  sorts: [],
  page: 1,
  pageSize: 50,
};

export default function ReportBuilder({
  reportId,
  onBack,
}: ReportBuilderProps) {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG);
  const [reportName, setReportName] = useState("Untitled Report");
  const [showShare, setShowShare] = useState(false);
  const [initialized, setInitialized] = useState(!reportId);

  // Load schema
  const { data: schema, isLoading: isSchemaLoading } = useReportSchema();
  const entities = schema?.entities ?? [];

  // Load saved report (if editing)
  const { data: savedReport } = useSavedReport(reportId);

  // Mutations
  const saveMutation = useSaveReportMutation();
  const exportMutation = useExportReport();

  // Initialize from saved report
  useEffect(() => {
    if (savedReport && !initialized) {
      setReportName(savedReport.name);
      setConfig({
        source: savedReport.source,
        columns: savedReport.config.columns ?? [],
        filters: (savedReport.config.filters ?? []) as FilterDef[],
        sorts: (savedReport.config.sorts ?? []) as SortDef[],
        page: 1,
        pageSize: savedReport.config.pageSize ?? 50,
      });
      setInitialized(true);
    }
  }, [savedReport, initialized]);

  // Execute the query
  const queryResult = useReportQuery(config);

  // Build DataGrid column defs from config
  const columnDefs: ColumnDef[] = useMemo(() => {
    const currentEntity = entities.find((e) => e.name === config.source);
    return config.columns.map((key) => {
      const colSchema = currentEntity?.columns.find((c) => c.key === key);
      const filterType =
        colSchema?.type === "number"
          ? "number"
          : colSchema?.type === "boolean"
          ? "boolean"
          : colSchema?.type === "date"
          ? "date"
          : "text";

      return {
        key,
        label: colSchema?.label ?? columnKeyToLabel(key),
        group: "Report",
        isDefault: true,
        filterType,
      };
    });
  }, [config.columns, config.source, entities]);

  // Handle sorting — DataGrid calls onSort with (column, shiftKey)
  const handleSort = useCallback(
    (column: string, shiftKey?: boolean) => {
      setConfig((prev) => {
        const existing = prev.sorts.find((s) => s.column === column);
        let newSorts: SortDef[];

        if (existing) {
          // Toggle direction or remove
          if (existing.direction === "asc") {
            newSorts = prev.sorts.map((s) =>
              s.column === column ? { ...s, direction: "desc" as const } : s
            );
          } else {
            // Remove this sort
            newSorts = prev.sorts.filter((s) => s.column !== column);
          }
        } else if (shiftKey) {
          // Add to existing sorts
          newSorts = [...prev.sorts, { column, direction: "asc" }];
        } else {
          // Replace with single sort
          newSorts = [{ column, direction: "asc" }];
        }

        return { ...prev, sorts: newSorts, page: 1 };
      });
    },
    []
  );

  const handlePageChange = useCallback((page: number) => {
    setConfig((prev) => ({ ...prev, page }));
  }, []);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setConfig((prev) => ({ ...prev, pageSize, page: 1 }));
  }, []);

  const handleSave = () => {
    saveMutation.mutate(
      {
        id: reportId ?? undefined,
        name: reportName,
        source: config.source,
        config: {
          columns: config.columns,
          filters: config.filters,
          sorts: config.sorts,
          pageSize: config.pageSize,
        },
      },
      {
        onSuccess: () => {
          // Stay on builder after save
        },
      }
    );
  };

  const handleExport = () => {
    exportMutation.mutate({
      source: config.source,
      columns: config.columns,
      filters: config.filters,
      sorts: config.sorts,
      reportName,
    });
  };

  const canSave = config.source.length > 0 && reportName.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-[#FFFCFA]">
      {/* Back button */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E2DEEC] bg-white">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-[#6E6390] hover:text-[#403770] transition-colors font-medium"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          All Reports
        </button>
      </div>

      {/* Schema error state */}
      {!isSchemaLoading && !schema && (
        <div className="mx-4 mt-4 bg-[#fef1f0] border border-[#f58d85] rounded-lg p-4 text-center">
          <p className="text-sm text-[#F37167] font-medium">
            Failed to load report schema
          </p>
        </div>
      )}

      {/* Config bar */}
      <ReportConfigBar
        config={config}
        onConfigChange={setConfig}
        entities={entities}
        isSchemaLoading={isSchemaLoading}
        reportName={reportName}
        onNameChange={setReportName}
        onSave={handleSave}
        onShare={() => setShowShare(true)}
        onExport={handleExport}
        isSaving={saveMutation.isPending}
        isExporting={exportMutation.isPending}
        canSave={canSave}
        canShare={!!reportId}
      />

      {/* Results */}
      <div className="flex-1 overflow-hidden">
        {config.source && config.columns.length > 0 ? (
          <DataGrid
            data={queryResult.data?.data ?? []}
            columnDefs={columnDefs}
            entityType={config.source}
            isLoading={queryResult.isLoading}
            isError={queryResult.isError}
            onRetry={() => queryResult.refetch()}
            visibleColumns={config.columns}
            onColumnsChange={(columns) =>
              setConfig((prev) => ({ ...prev, columns }))
            }
            sorts={config.sorts.map((s) => ({
              column: s.column,
              direction: s.direction,
            }))}
            onSort={handleSort}
            hasActiveFilters={config.filters.length > 0}
            onClearFilters={() =>
              setConfig((prev) => ({ ...prev, filters: [], page: 1 }))
            }
            pagination={queryResult.data?.pagination}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            rowIdAccessor={
              config.source === "districts"
                ? "leaid"
                : config.source === "schools"
                ? "ncessch"
                : config.source === "states"
                ? "fips"
                : "id"
            }
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#EFEDF5] rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-[#8A80A8]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 10h4v11H3zM10 3h4v18h-4zM17 7h4v14h-4z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-[#403770] mb-1">
                {!config.source
                  ? "Choose a data source"
                  : "Select columns to display"}
              </h3>
              <p className="text-xs text-[#8A80A8] max-w-xs">
                {!config.source
                  ? "Pick a data source from the dropdown above to start building your report."
                  : "Add columns from the toolbar above to see your data."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Share modal */}
      {showShare && reportId && (
        <ShareModal
          reportId={reportId}
          currentSharedWith={savedReport?.sharedWith ?? []}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
