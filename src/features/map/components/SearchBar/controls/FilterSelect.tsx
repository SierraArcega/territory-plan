"use client";

interface FilterSelectProps {
  label: string;
  column: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  onSelect: (column: string, value: string) => void;
}

export default function FilterSelect({ label, column, options, placeholder = "Select...", onSelect }: FilterSelectProps) {
  return (
    <div>
      <label className="text-xs font-medium text-[#8A80A8] mb-1.5 block">{label}</label>
      <select
        onChange={(e) => {
          if (e.target.value) {
            onSelect(column, e.target.value);
            e.target.value = "";
          }
        }}
        defaultValue=""
        className="w-full px-2.5 py-1.5 rounded-lg border border-[#D4CFE2] text-sm focus:outline-none focus:ring-2 focus:ring-plum/30"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
