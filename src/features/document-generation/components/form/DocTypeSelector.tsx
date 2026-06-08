"use client";
import type { DocType } from "@/features/document-generation/lib/payload-types";
interface Props { value: DocType; onChange: (d: DocType) => void; }
export default function DocTypeSelector({ value, onChange }: Props) {
  return (
    <select aria-label="Document type" value={value} onChange={(e) => onChange(e.target.value as DocType)}
      className="rounded border border-[#C2BBD4] px-2 py-1 text-sm font-semibold">
      <option value="contract">Contract</option>
      <option value="boces_quote">BOCES Quote</option>
    </select>
  );
}
