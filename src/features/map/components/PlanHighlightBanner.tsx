import { X } from "lucide-react";

interface PlanHighlightBannerProps {
  planName: string;
  districtCount: number;
  onClear: () => void;
}

export default function PlanHighlightBanner({
  planName,
  districtCount,
  onClear,
}: PlanHighlightBannerProps) {
  if (!planName) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-sm border border-[#D4CFE2] rounded-xl shadow-lg px-4 py-2 flex items-center gap-3">
      <span className="text-sm text-[#403770]">
        Showing {districtCount} district{districtCount !== 1 ? "s" : ""} from{" "}
        <span className="font-semibold">{planName}</span>
      </span>
      <button
        onClick={onClear}
        className="text-sm text-[#F37167] hover:text-[#e5574d] font-medium flex items-center gap-1 cursor-pointer"
      >
        Clear
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
