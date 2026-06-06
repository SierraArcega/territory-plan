"use client";
import type { DocFormState, SectionToggles } from "@/features/document-generation/lib/payload-types";

interface Props {
  state: DocFormState;
  onChange: (patch: Partial<DocFormState>) => void;
}

interface ToggleDef {
  key: keyof SectionToggles;
  label: string;
  show: (isBoces: boolean) => boolean;
}

const TOGGLES: ToggleDef[] = [
  { key: "staffing", label: "Staffing descriptions", show: () => true },
  { key: "boces", label: "BOCES pricing sheet", show: () => true },
  { key: "ek12", label: "EK12 pricing sheet", show: (isBoces) => !isBoces },
  { key: "hourly", label: "Hourly pricing sheet", show: (isBoces) => !isBoces },
  { key: "liveStaff", label: "Live staffing pricing sheet", show: (isBoces) => !isBoces },
  { key: "agreement", label: "BOCES agreement (MLSA)", show: (isBoces) => isBoces },
];

export default function SectionsToggles({ state, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";
  const set = (key: keyof SectionToggles, val: boolean) =>
    onChange({ sections: { ...state.sections, [key]: val } });

  return (
    <div className="space-y-1">
      {TOGGLES.filter((t) => t.show(isBoces)).map((t) => (
        <label key={t.key} className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={Boolean(state.sections[t.key])}
            onChange={(e) => set(t.key, e.target.checked)}
          />
          {t.label}
        </label>
      ))}
    </div>
  );
}
