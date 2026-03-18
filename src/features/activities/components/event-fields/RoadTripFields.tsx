"use client";

import AttendeeSelect from "./AttendeeSelect";
import ExpenseLineItems from "./ExpenseLineItems";

interface DistrictStop {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  visitDate: string;
  visitEndDate: string;
}

interface RoadTripFieldsProps {
  districtStops: DistrictStop[];
  onDistrictStopsChange: (stops: DistrictStop[]) => void;
  attendeeUserIds: string[];
  onAttendeeChange: (userIds: string[]) => void;
  expenses: { description: string; amount: number }[];
  onExpensesChange: (expenses: { description: string; amount: number }[]) => void;
}

export default function RoadTripFields({
  districtStops,
  onDistrictStopsChange,
  attendeeUserIds,
  onAttendeeChange,
  expenses,
  onExpensesChange,
}: RoadTripFieldsProps) {
  const updateStopDate = (index: number, field: "visitDate" | "visitEndDate", value: string) => {
    const updated = districtStops.map((stop, i) =>
      i === index ? { ...stop, [field]: value } : stop
    );
    onDistrictStopsChange(updated);
  };

  return (
    <div className="space-y-5">
      {/* District stops with visit dates */}
      {districtStops.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            District Stops
          </label>
          <div className="space-y-2">
            {districtStops.map((stop, i) => (
              <div
                key={stop.leaid}
                className="border border-gray-200 rounded-lg p-3"
              >
                <div className="text-sm font-medium text-gray-800 mb-2">
                  {stop.name}
                  {stop.stateAbbrev && (
                    <span className="text-gray-400 ml-1">({stop.stateAbbrev})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={stop.visitDate}
                    onChange={(e) => updateStopDate(i, "visitDate", e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                  />
                  <span className="text-gray-400 text-xs">to</span>
                  <input
                    type="date"
                    value={stop.visitEndDate}
                    onChange={(e) => updateStopDate(i, "visitEndDate", e.target.value)}
                    min={stop.visitDate}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Add districts in the Districts section above, then set visit dates here.
          </p>
        </div>
      )}

      {districtStops.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          Add districts to this road trip to set per-stop visit dates.
        </p>
      )}

      {/* Attendees */}
      <AttendeeSelect selectedUserIds={attendeeUserIds} onChange={onAttendeeChange} />

      {/* Expenses */}
      <ExpenseLineItems expenses={expenses} onChange={onExpensesChange} />
    </div>
  );
}
