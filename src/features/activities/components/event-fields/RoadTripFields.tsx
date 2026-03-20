"use client";

import { useState, useCallback } from "react";
import DistrictSearchInput from "./DistrictSearchInput";

interface DistrictStop {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  visitDate: string;
  notes: string;
}

interface RoadTripFieldsProps {
  districtStops: DistrictStop[];
  onDistrictStopsChange: (stops: DistrictStop[]) => void;
}

export default function RoadTripFields({
  districtStops,
  onDistrictStopsChange,
}: RoadTripFieldsProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const updateStop = useCallback(
    (index: number, field: keyof Pick<DistrictStop, "visitDate" | "notes">, value: string) => {
      const updated = districtStops.map((stop, i) =>
        i === index ? { ...stop, [field]: value } : stop
      );
      onDistrictStopsChange(updated);
    },
    [districtStops, onDistrictStopsChange]
  );

  const removeStop = useCallback(
    (index: number) => {
      const updated = districtStops.filter((_, i) => i !== index);
      onDistrictStopsChange(updated);
    },
    [districtStops, onDistrictStopsChange]
  );

  const handleAddStop = useCallback(
    (district: { leaid: string; name: string; stateAbbrev: string | null }) => {
      const newStop: DistrictStop = {
        leaid: district.leaid,
        name: district.name,
        stateAbbrev: district.stateAbbrev,
        visitDate: "",
        notes: "",
      };
      onDistrictStopsChange([...districtStops, newStop]);
      setShowSearch(false);
    },
    [districtStops, onDistrictStopsChange]
  );

  // HTML5 Drag-and-Drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
      setDraggedIndex(index);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTargetIndex(index);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);

      if (isNaN(sourceIndex) || sourceIndex === targetIndex) {
        setDraggedIndex(null);
        setDropTargetIndex(null);
        return;
      }

      const updated = [...districtStops];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      onDistrictStopsChange(updated);

      setDraggedIndex(null);
      setDropTargetIndex(null);
    },
    [districtStops, onDistrictStopsChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }, []);

  const excludeLeaids = districtStops.map((s) => s.leaid);

  return (
    <div className="space-y-3">
      {districtStops.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-2">
            District Stops
          </label>
          <div className="space-y-2">
            {districtStops.map((stop, i) => (
              <div
                key={stop.leaid}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className={`border border-[#E2DEEC] rounded-lg p-3 bg-[#FDFCFF] transition-all ${
                  draggedIndex === i ? "shadow-md opacity-75" : ""
                }`}
              >
                {/* Drop indicator line above this card */}
                {dropTargetIndex === i && draggedIndex !== null && draggedIndex !== i && (
                  <div className="h-0.5 bg-[#403770] -mt-3 mb-2 rounded-full" />
                )}

                {/* Top row: drag handle, number, name, remove */}
                <div className="flex items-center gap-2">
                  {/* Drag handle */}
                  <span
                    className="text-[#A69DC0] cursor-grab active:cursor-grabbing select-none text-sm leading-none"
                    title="Drag to reorder"
                  >
                    ⠿
                  </span>

                  {/* Numbered circle */}
                  <span className="w-5 h-5 rounded-full bg-[#403770] text-white text-xs flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>

                  {/* District name */}
                  <span className="text-sm font-medium text-[#403770] flex-1 min-w-0 truncate">
                    {stop.name}
                    {stop.stateAbbrev && (
                      <span className="text-[#A69DC0] ml-1">· {stop.stateAbbrev}</span>
                    )}
                  </span>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeStop(i)}
                    className="text-[#A69DC0] hover:text-[#F37167] transition-colors flex-shrink-0 text-lg leading-none"
                    title="Remove stop"
                  >
                    ×
                  </button>
                </div>

                {/* Bottom row: date and notes */}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="date"
                    value={stop.visitDate}
                    onChange={(e) => updateStop(i, "visitDate", e.target.value)}
                    className="w-36 px-2 py-1.5 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={stop.notes}
                    onChange={(e) => updateStop(i, "notes", e.target.value)}
                    placeholder="Add notes..."
                    className="flex-1 px-2 py-1.5 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {districtStops.length === 0 && (
        <p className="text-sm text-[#A69DC0] italic">
          Add districts to this road trip to set per-stop visit dates.
        </p>
      )}

      {/* Add Stop button / search */}
      <div>
        {showSearch ? (
          <div className="space-y-2">
            <DistrictSearchInput
              excludeLeaids={excludeLeaids}
              onSelect={handleAddStop}
            />
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              className="text-xs text-[#A69DC0] hover:text-[#403770] transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="text-sm font-medium text-[#F37167] hover:text-[#d4544a] transition-colors"
          >
            + Add Stop
          </button>
        )}
      </div>
    </div>
  );
}
