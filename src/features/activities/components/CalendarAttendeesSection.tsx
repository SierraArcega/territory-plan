"use client";

import { useState, useEffect, useCallback } from "react";
import { useCalendarAttendees } from "@/features/activities/lib/queries";
import DistrictSearchInput from "@/features/activities/components/event-fields/DistrictSearchInput";
import type { AttendeeSelection } from "@/features/activities/lib/outcome-types-api";

export type { CalendarAttendee, AttendeeSelection } from "@/features/activities/lib/outcome-types-api";

interface CalendarAttendeesSectionProps {
  activityId: string;
  onAttendeesChange: (attendees: AttendeeSelection[]) => void;
}

const labelStyle =
  "block text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider";

export default function CalendarAttendeesSection({
  activityId,
  onAttendeesChange,
}: CalendarAttendeesSectionProps) {
  const { data: attendees, isLoading, isError } = useCalendarAttendees(activityId);
  const [selections, setSelections] = useState<AttendeeSelection[]>([]);

  // Initialize selections when attendees load
  useEffect(() => {
    if (!attendees) return;
    const initial: AttendeeSelection[] = attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      checked: !a.existingContact, // checked by default for external, unchecked for existing
      district: a.matchedDistrict,
      existingContactId: a.existingContact?.id ?? null,
    }));
    setSelections(initial);
    onAttendeesChange(initial);
  }, [attendees]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback(
    (index: number) => {
      setSelections((prev) => {
        const updated = prev.map((s, i) =>
          i === index ? { ...s, checked: !s.checked } : s
        );
        onAttendeesChange(updated);
        return updated;
      });
    },
    [onAttendeesChange]
  );

  const handleDistrictAssign = useCallback(
    (index: number, district: { leaid: string; name: string; stateAbbrev: string | null }) => {
      setSelections((prev) => {
        const updated = prev.map((s, i) =>
          i === index ? { ...s, district: { leaid: district.leaid, name: district.name } } : s
        );
        onAttendeesChange(updated);
        return updated;
      });
    },
    [onAttendeesChange]
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div>
        <p className={labelStyle}>Attendees from Calendar</p>
        <div className="mt-2 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#F7F5FA] animate-pulse">
              <div className="w-4 h-4 rounded bg-[#E2DEEC]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-[#E2DEEC]" />
                <div className="h-2.5 w-48 rounded bg-[#E2DEEC]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div>
        <p className={labelStyle}>Attendees from Calendar</p>
        <p className="mt-1.5 text-xs font-medium text-[#f58d85]">
          Couldn&apos;t fetch attendees &mdash; add contacts manually below.
        </p>
      </div>
    );
  }

  // No attendees
  if (!attendees || attendees.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className={labelStyle}>Attendees from Calendar</p>
        <span className="text-[10px] font-medium text-[#A69DC0]">
          ({attendees.length} found)
        </span>
      </div>

      <div className="space-y-1.5">
        {selections.map((selection, index) => {
          const isExisting = selection.existingContactId !== null;
          return (
            <div
              key={selection.email}
              className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[#E2DEEC] bg-white"
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selection.checked}
                disabled={isExisting}
                onChange={() => handleToggle(index)}
                className="mt-0.5 w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />

              <div className="flex-1 min-w-0">
                {/* Name + email */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selection.displayName && (
                    <span className="text-sm font-medium text-[#403770]">
                      {selection.displayName}
                    </span>
                  )}
                  <span className="text-xs text-[#8A80A8] truncate">
                    {selection.email}
                  </span>
                </div>

                {/* District badge or search */}
                <div className="mt-1">
                  {isExisting ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EFEDF5] text-[#A69DC0]">
                      Already in database
                    </span>
                  ) : selection.district ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EFF5F0] text-[#8AA891]">
                      {selection.district.name}
                    </span>
                  ) : (
                    <div className="mt-1">
                      <DistrictSearchInput
                        excludeLeaids={[]}
                        onSelect={(d) => handleDistrictAssign(index, d)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
