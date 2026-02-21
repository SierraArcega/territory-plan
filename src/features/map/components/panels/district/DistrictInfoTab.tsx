"use client";

import type { DistrictDetail } from "@/lib/api";
import FullmindMetrics from "@/components/panel/FullmindMetrics";
import CompetitorSpend from "@/components/panel/CompetitorSpend";
import AddToPlanButton from "./AddToPlanButton";
import FindSimilarDistricts from "./FindSimilarDistricts";
import CharterSchools from "./CharterSchools";
import DistrictInfo from "@/components/panel/DistrictInfo";
import TagsEditor from "@/components/panel/TagsEditor";
import NotesEditor from "@/components/panel/NotesEditor";
import TaskList from "@/components/tasks/TaskList";

interface DistrictInfoTabProps {
  data: DistrictDetail;
  leaid: string;
}

export default function DistrictInfoTab({ data, leaid }: DistrictInfoTabProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Fullmind Data */}
      {data.fullmindData && (
        <FullmindMetrics fullmindData={data.fullmindData} />
      )}

      {/* Competitor Spend */}
      <CompetitorSpend leaid={leaid} />

      {/* Action Buttons */}
      <div className="px-3 py-3 border-b border-gray-100 bg-gray-50/50 flex gap-2">
        <AddToPlanButton
          leaid={leaid}
          existingPlanIds={data.territoryPlanIds}
        />
        <FindSimilarDistricts
          district={data.district}
          educationData={data.educationData}
          enrollmentDemographics={data.enrollmentDemographics}
        />
      </div>

      {/* Charter Schools */}
      <CharterSchools leaid={leaid} />

      {/* District Info */}
      <DistrictInfo district={data.district} />

      {/* Tags Editor */}
      <div className="px-3 py-3 border-b border-gray-100">
        <TagsEditor leaid={leaid} tags={data.tags} />
      </div>

      {/* Notes Editor */}
      <div className="px-3 py-3 border-b border-gray-100">
        <NotesEditor leaid={leaid} edits={data.edits} />
      </div>

      {/* Tasks linked to this district */}
      <div className="px-3 py-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tasks</h3>
        <TaskList leaid={leaid} compact />
      </div>
    </div>
  );
}
