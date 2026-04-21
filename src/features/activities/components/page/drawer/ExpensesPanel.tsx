"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Activity } from "@/features/shared/types/api-types";
import { useUpdateActivity } from "@/features/activities/lib/queries";

interface ExpensesPanelProps {
  activity: Activity;
  readOnly: boolean;
}

export default function ExpensesPanel({ activity, readOnly }: ExpensesPanelProps) {
  const update = useUpdateActivity();
  const [draft, setDraft] = useState<{ description: string; amount: string }>({
    description: "",
    amount: "",
  });

  const total = activity.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  function persist(next: { description: string; amount: number }[]) {
    update.mutate({ activityId: activity.id, expenses: next });
  }

  function addExpense() {
    const amount = Number(draft.amount);
    if (!draft.description.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const next = [
      ...activity.expenses.map((e) => ({ description: e.description, amount: Number(e.amount) })),
      { description: draft.description.trim(), amount },
    ];
    persist(next);
    setDraft({ description: "", amount: "" });
  }

  function removeAt(index: number) {
    const next = activity.expenses
      .filter((_, i) => i !== index)
      .map((e) => ({ description: e.description, amount: Number(e.amount) }));
    persist(next);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Total strip */}
      <div className="px-5 py-4 border-b border-[#E2DEEC] bg-[#FFFCFA]">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8]">
          Total expenses
        </div>
        <div className="text-2xl font-bold text-[#403770]">
          ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-[#A69DC0]">
          {activity.expenses.length} line item{activity.expenses.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {activity.expenses.length === 0 ? (
          <div className="text-xs text-[#A69DC0]">No expenses logged yet.</div>
        ) : (
          <ul className="divide-y divide-[#F0EDF7]">
            {activity.expenses.map((e, i) => (
              <li key={e.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2">
                <div className="text-sm text-[#403770]">{e.description}</div>
                <div className="text-sm font-semibold text-[#403770] tabular-nums">
                  ${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label="Remove expense"
                    onClick={() => removeAt(i)}
                    className="text-[#A69DC0] hover:text-[#F37167]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add expense */}
      {!readOnly && (
        <div className="border-t border-[#E2DEEC] bg-[#FFFCFA] px-5 py-3 grid grid-cols-[1fr_120px_auto] gap-2">
          <input
            type="text"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Description"
            className="px-2.5 py-1.5 text-sm border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167]"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            placeholder="0.00"
            className="px-2.5 py-1.5 text-sm border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] tabular-nums"
          />
          <button
            type="button"
            onClick={addExpense}
            disabled={!draft.description.trim() || !draft.amount}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}
