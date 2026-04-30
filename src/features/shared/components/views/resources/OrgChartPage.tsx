"use client";

import { ExternalLink } from "lucide-react";

const CANVA_ORG_CHART_URL =
  "https://www.canva.com/design/DAHENoDrpIo/JyiNr7r6qjNs2U7mtpQwMw/edit";

const CANVA_EMBED_URL =
  "https://www.canva.com/design/DAHENoDrpIo/PAZw4HMc-e81me7Q46wOlQ/view?embed";

export default function OrgChartPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-bold text-[#403770] tracking-tight">
          Fullmind Org Chart
        </h1>
        <p className="mt-1 text-sm text-[#8A80A8]">
          Who&apos;s who, reporting lines, and team structure — maintained in
          Canva.
        </p>
      </header>

      <div
        className="relative w-full flex-1 min-h-[400px] overflow-hidden rounded-lg"
        style={{
          boxShadow: "0 2px 8px 0 rgba(63,69,81,0.16)",
        }}
      >
        <iframe
          src={CANVA_EMBED_URL}
          loading="lazy"
          allowFullScreen
          allow="fullscreen"
          title="Fullmind Org Chart"
          className="absolute left-0 top-0 h-full w-full border-0"
        />
      </div>

      <div className="mt-4 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#8A80A8]">
          Designed by Amy Warner · Kept current in Canva
        </p>
        <a
          href={CANVA_ORG_CHART_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#F37167] px-4 py-2 text-sm font-medium text-white transition-colors duration-100 hover:bg-[#E85D52] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F37167] focus-visible:ring-offset-2"
        >
          Open in Canva
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <p className="mt-3 flex-shrink-0 text-xs text-[#8A80A8]">
        Questions about structure or updates? Reach out to the team lead listed
        on the chart.
      </p>
    </div>
  );
}
