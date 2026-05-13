"use client";

/**
 * ConditionsEditor — flat AND list of rules with a trailing "+ Add condition"
 * affordance. Wraps `ConditionRow` and owns the add/remove/replace plumbing.
 *
 * Both the source-conditions section AND the scope=rules sub-editor reuse
 * this component — same shape, different `source`.
 */
import { Plus } from "lucide-react";
import type {
  FilterLeaf,
  SavedListSource,
} from "@/lib/saved-views/filter-tree";
import { defaultRule } from "./builder-utils";
import ConditionRow from "./ConditionRow";

interface ConditionsEditorProps {
  rules: readonly FilterLeaf[];
  source: SavedListSource;
  onChange: (next: FilterLeaf[]) => void;
  addLabel?: string;
}

export default function ConditionsEditor({
  rules,
  source,
  onChange,
  addLabel = "Add condition",
}: ConditionsEditorProps) {
  const replace = (idx: number, next: FilterLeaf) => {
    onChange(rules.map((r, i) => (i === idx ? next : r)));
  };

  const remove = (idx: number) => {
    onChange(rules.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([...rules, defaultRule(source)]);
  };

  return (
    <div className="flex flex-col gap-1">
      {rules.map((row, i) => (
        <ConditionRow
          key={`${i}-${row.fieldId}`}
          idx={i}
          row={row}
          source={source}
          onReplace={(next) => replace(i, next)}
          onDelete={() => remove(i)}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex self-start items-center gap-1.5 px-2.5 py-1.5 mt-1 rounded-lg border border-dashed border-[#D4CFE2] text-[#544A78] text-xs font-medium hover:text-[#403770] hover:border-[#403770] hover:bg-[#FEF2F1] transition-colors duration-100"
      >
        <Plus className="w-3 h-3" aria-hidden strokeWidth={2.5} />
        <span className="whitespace-nowrap">{addLabel}</span>
      </button>
    </div>
  );
}
