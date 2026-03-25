"use client";

import { useState } from "react";
import ReportsList from "./ReportsList";
import ReportBuilder from "./ReportBuilder";

/**
 * ReportsView — top-level view for the Reports tab.
 * Routes between the saved reports list and the report builder.
 */
export default function ReportsView() {
  // null = show list, "new" = new report, UUID = editing saved report
  const [activeReportId, setActiveReportId] = useState<string | "new" | null>(
    null
  );

  if (activeReportId !== null) {
    return (
      <ReportBuilder
        reportId={activeReportId === "new" ? null : activeReportId}
        onBack={() => setActiveReportId(null)}
      />
    );
  }

  return (
    <ReportsList
      onNewReport={() => setActiveReportId("new")}
      onOpenReport={(id) => setActiveReportId(id)}
    />
  );
}
