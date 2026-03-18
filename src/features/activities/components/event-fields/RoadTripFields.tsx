"use client";

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
}

export default function RoadTripFields({
  districtStops,
  onDistrictStopsChange,
}: RoadTripFieldsProps) {
  const updateStopDate = (index: number, field: "visitDate" | "visitEndDate", value: string) => {
    const updated = districtStops.map((stop, i) =>
      i === index ? { ...stop, [field]: value } : stop
    );
    onDistrictStopsChange(updated);
  };

  return (
    <div className="space-y-4">
      {districtStops.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            District Stops
          </label>
          <div className="space-y-2">
            {districtStops.map((stop, i) => (
              <div
                key={stop.leaid}
                className="border border-[#E2DEEC] rounded-lg p-3 bg-[#FDFCFF]"
              >
                <div className="text-sm font-medium text-[#403770] mb-2">
                  {stop.name}
                  {stop.stateAbbrev && (
                    <span className="text-[#A69DC0] ml-1">({stop.stateAbbrev})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={stop.visitDate}
                    onChange={(e) => updateStopDate(i, "visitDate", e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
                  />
                  <span className="text-[#A69DC0] text-xs">to</span>
                  <input
                    type="date"
                    value={stop.visitEndDate}
                    onChange={(e) => updateStopDate(i, "visitEndDate", e.target.value)}
                    min={stop.visitDate}
                    className="flex-1 px-2 py-1.5 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-[#A69DC0]">
            Add districts in the Districts section above, then set visit dates here.
          </p>
        </div>
      )}

      {districtStops.length === 0 && (
        <p className="text-sm text-[#A69DC0] italic">
          Add districts to this road trip to set per-stop visit dates.
        </p>
      )}
    </div>
  );
}
