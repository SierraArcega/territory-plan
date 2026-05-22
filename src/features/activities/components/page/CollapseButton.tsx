import { ChevronUp } from "lucide-react";

interface CollapseButtonProps {
  onClick: () => void;
  label: string;
  className?: string;
}

export function CollapseButton({ onClick, label, className = "" }: CollapseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sm:hidden p-1.5 rounded-md text-[#8A80A8] hover:text-[#403770] hover:bg-[#F7F5FA] transition-colors${className ? ` ${className}` : ""}`}
      aria-label={label}
    >
      <ChevronUp className="w-3.5 h-3.5" />
    </button>
  );
}
