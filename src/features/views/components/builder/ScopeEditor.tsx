"use client";

/**
 * ScopeEditor — three-tab scope picker that only renders for non-`districts`
 * sources. Limits the candidate set to a district subset before the source
 * conditions apply.
 *
 *   - "Any district"        (none)       — no scope; query runs over all rows.
 *   - "Matching rules"      (rules)      — flat ConditionsEditor over districts.
 *   - "In a plan or list"   (reference)  — dropdown of all plans + lists.
 *
 * Reference dropdown reads from `usePlansWithStats()` + `useLists()`. Each
 * option is prefixed by 🎯 (plan) or 📋 (list).
 */
import type {
  FilterLeaf,
  ScopeMode,
  ScopeRefKind,
} from "@/lib/saved-views/filter-tree";
import { useLists, usePlansWithStats } from "../../lib/queries";
import ConditionsEditor from "./ConditionsEditor";

interface ScopeEditorProps {
  mode: ScopeMode;
  scopeRules: readonly FilterLeaf[];
  refKind: ScopeRefKind | null;
  refId: string | null;
  onModeChange: (mode: ScopeMode) => void;
  onRulesChange: (rules: FilterLeaf[]) => void;
  onRefChange: (kind: ScopeRefKind, id: string) => void;
}

interface ScopeOption {
  id: string;
  kind: ScopeRefKind;
  label: string;
}

const TABS: ReadonlyArray<{ id: ScopeMode; label: string }> = [
  { id: "none", label: "Any district" },
  { id: "rules", label: "Matching rules" },
  { id: "reference", label: "In a plan or list" },
];

export default function ScopeEditor({
  mode,
  scopeRules,
  refKind,
  refId,
  onModeChange,
  onRulesChange,
  onRefChange,
}: ScopeEditorProps) {
  const plansQ = usePlansWithStats();
  const listsQ = useLists();

  const options: ScopeOption[] = [
    ...(plansQ.data ?? []).map<ScopeOption>((p) => ({
      id: p.id,
      kind: "plan",
      label: p.name,
    })),
    ...(listsQ.data ?? []).map<ScopeOption>((l) => ({
      id: l.id,
      kind: "list",
      label: l.name,
    })),
  ];

  const selectedOption = options.find(
    (o) => o.id === refId && o.kind === refKind,
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Scope mode"
        className="flex gap-0.5 p-0.5 bg-[#F7F5FA] rounded-lg"
      >
        {TABS.map((t) => {
          const active = mode === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onModeChange(t.id)}
              className={[
                "flex-1 px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors duration-100 whitespace-nowrap",
                active
                  ? "bg-white text-[#403770] font-semibold shadow-sm"
                  : "bg-transparent text-[#8A80A8] hover:text-[#403770]",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {mode === "rules" && (
        <div className="mt-2">
          <ConditionsEditor
            rules={scopeRules}
            source="districts"
            onChange={onRulesChange}
            addLabel="Add condition"
          />
        </div>
      )}

      {mode === "reference" && (
        <div className="mt-2 p-2.5 bg-white border border-[#E2DEEC] rounded-lg">
          <select
            aria-label="Scope reference"
            value={refId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const opt = options.find((o) => o.id === v);
              if (opt) onRefChange(opt.kind, opt.id);
            }}
            className="w-full px-2.5 py-1.5 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-md outline-none focus:border-[#403770]"
          >
            <option value="" disabled>
              {plansQ.isLoading || listsQ.isLoading
                ? "Loading…"
                : "Select plan or list"}
            </option>
            {options.map((o) => (
              <option key={`${o.kind}:${o.id}`} value={o.id}>
                {o.kind === "plan" ? "🎯" : "📋"} {o.label}
              </option>
            ))}
          </select>
          {selectedOption && (
            <p className="text-[11px] text-[#8A80A8] mt-1.5">
              Updates automatically as{" "}
              <strong className="text-[#403770] font-semibold">
                {selectedOption.label}
              </strong>{" "}
              changes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
