"use client";

interface ChipOption {
  label: string;
  column: string;
  op: string;
  value: any;
}

interface ToggleChipsProps {
  label: string;
  options: ChipOption[];
  onSelect: (option: ChipOption) => void;
}

export default function ToggleChips({ label, options, onSelect }: ToggleChipsProps) {
  return (
    <div>
      <label className="text-xs font-medium text-[#8A80A8] mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt)}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F7F5FA] text-[#544A78] hover:bg-plum/10 hover:text-plum transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
