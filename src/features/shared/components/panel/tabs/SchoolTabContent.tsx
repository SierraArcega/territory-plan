"use client";

import { useState } from "react";
import {
  useSchoolDetail,
  useUpdateSchoolEdits,
  useSalesExecutives,
} from "@/lib/api";
import { useMapStore } from "@/features/shared/lib/app-store";

// School level labels
const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Primary",
  2: "Middle",
  3: "High",
  4: "Other",
};

// School level colors (matching map layer)
const SCHOOL_LEVEL_COLORS: Record<number, string> = {
  1: "#22C55E", // green
  2: "#F59E0B", // amber
  3: "#6366F1", // indigo
  4: "#9CA3AF", // gray
};

interface SchoolTabContentProps {
  ncessch: string | null;
}

export default function SchoolTabContent({ ncessch }: SchoolTabContentProps) {
  const { data: school, isLoading, error } = useSchoolDetail(ncessch);
  const openDistrictPanel = useMapStore((s) => s.openDistrictPanel);

  if (!ncessch) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <svg
          className="w-16 h-16 text-gray-200 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
          />
        </svg>
        <p className="text-gray-500 font-medium">No school selected</p>
        <p className="text-gray-400 text-sm mt-1">
          Click on a school point on the map to view details
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-red-500">
          <p className="font-medium">Error loading school</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!school) return null;

  const levelLabel = school.schoolLevel ? SCHOOL_LEVEL_LABELS[school.schoolLevel] : null;
  const levelColor = school.schoolLevel ? SCHOOL_LEVEL_COLORS[school.schoolLevel] : "#9CA3AF";
  const gradeRange =
    school.lograde && school.higrade
      ? `${school.lograde}-${school.higrade}`
      : school.lograde || school.higrade || null;

  return (
    <div className="h-full flex flex-col">
      {/* Back to district link */}
      {school.district && (
        <button
          onClick={() => openDistrictPanel(school.leaid)}
          className="flex items-center gap-1 px-6 py-2 text-sm text-[#403770] hover:text-[#F37167] bg-gray-50 border-b border-gray-100 w-full"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {school.district.name}
        </button>
      )}

      {/* School Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-bold text-[#403770] leading-tight">
          {school.schoolName}
        </h2>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {school.charter === 1 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F37167]/10 text-[#F37167]">
              Charter
            </span>
          )}
          {levelLabel && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${levelColor}15`,
                color: levelColor,
              }}
            >
              {levelLabel}
            </span>
          )}
          {gradeRange && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Grades {gradeRange}
            </span>
          )}
          {school.schoolStatus === 2 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              Closed
            </span>
          )}
        </div>
        {school.city && school.stateAbbrev && (
          <p className="text-sm text-gray-500 mt-1">
            {school.city}, {school.stateAbbrev}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Quick stats */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Enrollment</p>
              <p className="text-lg font-bold text-[#403770]">
                {school.enrollment != null ? school.enrollment.toLocaleString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">District</p>
              <button
                onClick={() => openDistrictPanel(school.leaid)}
                className="text-sm font-medium text-[#403770] hover:text-[#F37167] text-left truncate max-w-full"
              >
                {school.district?.name || school.leaid}
              </button>
            </div>
            {school.phone && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                <p className="text-sm text-gray-700">{school.phone}</p>
              </div>
            )}
            {school.urbanCentricLocale && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Locale</p>
                <p className="text-sm text-gray-700">Code {school.urbanCentricLocale}</p>
              </div>
            )}
          </div>
        </div>

        {/* Enrollment trend chart */}
        {school.enrollmentHistory && school.enrollmentHistory.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Enrollment Trend
            </h3>
            <EnrollmentChart data={school.enrollmentHistory} />
          </div>
        )}

        {/* CRM Section - Owner */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Owner
          </h3>
          <SchoolOwnerEditor ncessch={school.ncessch} currentOwner={school.owner} />
        </div>

        {/* CRM Section - Notes */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Notes
          </h3>
          <SchoolNotesEditor ncessch={school.ncessch} currentNotes={school.notes} />
        </div>

        {/* Tags */}
        {school.tags && school.tags.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {school.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contacts */}
        {school.contacts && school.contacts.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Contacts ({school.contacts.length})
            </h3>
            <div className="space-y-2">
              {school.contacts.map((contact) => (
                <div key={contact.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                    {contact.title && (
                      <p className="text-xs text-gray-500 truncate">{contact.title}</p>
                    )}
                    {contact.email && (
                      <p className="text-xs text-[#403770] truncate">{contact.email}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact info */}
        {(school.streetAddress || school.zip) && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Address
            </h3>
            <p className="text-sm text-gray-700">
              {school.streetAddress && <>{school.streetAddress}<br /></>}
              {school.city && `${school.city}, `}
              {school.stateAbbrev} {school.zip}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple enrollment bar chart component
function EnrollmentChart({
  data,
}: {
  data: { year: number; enrollment: number | null }[];
}) {
  const filteredData = data.filter((d) => d.enrollment != null);
  if (filteredData.length === 0) return null;

  const maxEnrollment = Math.max(...filteredData.map((d) => d.enrollment!));

  return (
    <div className="flex items-end gap-1.5 h-24">
      {filteredData.map((d) => {
        const height = maxEnrollment > 0 ? (d.enrollment! / maxEnrollment) * 100 : 0;
        return (
          <div key={d.year} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-gray-500 font-medium">
              {d.enrollment!.toLocaleString()}
            </span>
            <div
              className="w-full rounded-t-sm bg-[#F37167]/70 hover:bg-[#F37167] transition-colors min-h-[2px]"
              style={{ height: `${Math.max(height, 2)}%` }}
              title={`${d.year}: ${d.enrollment!.toLocaleString()}`}
            />
            <span className="text-[10px] text-gray-400">
              {String(d.year).slice(-2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Owner editor component
function SchoolOwnerEditor({
  ncessch,
  currentOwner,
}: {
  ncessch: string;
  currentOwner: string | null;
}) {
  const updateEdits = useUpdateSchoolEdits();
  const { data: salesExecs } = useSalesExecutives();

  return (
    <select
      value={currentOwner || ""}
      onChange={(e) => {
        updateEdits.mutate({
          ncessch,
          owner: e.target.value || undefined,
        });
      }}
      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770]"
    >
      <option value="">Unassigned</option>
      {salesExecs?.map((exec) => (
        <option key={exec} value={exec}>
          {exec}
        </option>
      ))}
    </select>
  );
}

// Notes editor component
function SchoolNotesEditor({
  ncessch,
  currentNotes,
}: {
  ncessch: string;
  currentNotes: string | null;
}) {
  const [notes, setNotes] = useState(currentNotes || "");
  const [isDirty, setIsDirty] = useState(false);
  const updateEdits = useUpdateSchoolEdits();

  const handleSave = () => {
    updateEdits.mutate({ ncessch, notes });
    setIsDirty(false);
  };

  return (
    <div>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setIsDirty(true);
        }}
        placeholder="Add notes about this school..."
        rows={3}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770]"
      />
      {isDirty && (
        <div className="flex justify-end mt-1.5">
          <button
            onClick={handleSave}
            disabled={updateEdits.isPending}
            className="px-3 py-1 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#332c5c] disabled:opacity-50"
          >
            {updateEdits.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
