"use client";

import { ExternalLink, Users } from "lucide-react";

const CANVA_ORG_CHART_URL =
  "https://www.canva.com/design/DAHENoDrpIo/JyiNr7r6qjNs2U7mtpQwMw/edit";

export default function OrgChartPage() {
  return (
    <div className="max-w-[720px]">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#403770] tracking-tight">
          Fullmind Org Chart
        </h1>
        <p className="mt-1 text-sm text-[#8A80A8]">
          Who&apos;s who, reporting lines, and team structure — maintained in
          Canva.
        </p>
      </header>

      <div className="rounded-lg border border-[#E2DEEC] bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FEF2F1]">
            <Users className="h-5 w-5 text-[#F37167]" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[#403770]">
              Open the live org chart
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#6E6390]">
              The current Fullmind organizational chart is kept up to date in
              Canva. Open it to find anyone at the company, see reporting
              structure, and identify who leads each team.
            </p>
            <a
              href={CANVA_ORG_CHART_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#F37167] px-4 py-2 text-sm font-medium text-white transition-colors duration-100 hover:bg-[#E85D52] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F37167] focus-visible:ring-offset-2"
            >
              Open in Canva
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-[#8A80A8]">
        Questions about structure or updates? Reach out to the team lead listed
        on the chart.
      </p>
    </div>
  );
}
