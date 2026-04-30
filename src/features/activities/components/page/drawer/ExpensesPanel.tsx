"use client";

import { useState } from "react";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import {
  useCreateActivityExpense,
  useDeleteActivityExpense,
} from "@/features/activities/lib/queries";
import { type ExpenseCategory } from "@/features/activities/types";
import type { Activity } from "@/features/shared/types/api-types";
import ExpenseEditor, { type ExpenseEditorInput } from "./ExpenseEditor";
import MissingReceiptPill from "./MissingReceiptPill";

interface ExpensesPanelProps {
  activity: Activity;
  readOnly: boolean;
  onSaved?: () => void;
}

const EXPENSE_CAT_STYLE: Record<
  ExpenseCategory,
  { label: string; tint: string; ink: string }
> = {
  travel: { label: "Travel", tint: "#e8f1f5", ink: "#4d7285" },
  meals: { label: "Meals", tint: "#fffaf1", ink: "#997c43" },
  lodging: { label: "Lodging", tint: "#EDFFE3", ink: "#5f665b" },
  swag: { label: "Swag", tint: "#fef1f0", ink: "#c25a52" },
  other: { label: "Other", tint: "#F7F5FA", ink: "#6E6390" },
};

function fmtMoneyCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ExpensesPanel({ activity, readOnly, onSaved }: ExpensesPanelProps) {
  const create = useCreateActivityExpense();
  const remove = useDeleteActivityExpense();
  const [adding, setAdding] = useState(false);

  const totalCents = activity.expenses.reduce(
    (s, e) => s + (e.amountCents ?? Math.round(Number(e.amount || 0) * 100)),
    0
  );
  const missingReceiptCount = activity.expenses.filter(
    (e) => !e.receiptStoragePath
  ).length;

  function handleAdd(input: ExpenseEditorInput) {
    create.mutate(
      { activityId: activity.id, expense: input },
      {
        onSuccess: () => {
          setAdding(false);
          onSaved?.();
        },
      }
    );
  }

  function handleRemove(expenseId: string) {
    remove.mutate(
      { activityId: activity.id, expenseId },
      { onSuccess: () => onSaved?.() }
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-5 space-y-3.5">
        {/* Summary strip */}
        <div className="flex items-center justify-between p-3.5 rounded-[10px] bg-[#F7F5FA] border border-[#E2DEEC]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] font-bold text-[#8A80A8]">
              Total expenses
            </div>
            <div className="text-2xl font-bold text-[#403770] tabular-nums leading-tight mt-0.5">
              {fmtMoneyCents(totalCents)}
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-[11px] text-[#8A80A8]">
              {activity.expenses.length} item{activity.expenses.length === 1 ? "" : "s"}
            </div>
            <MissingReceiptPill count={missingReceiptCount} />
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-1.5">
          {activity.expenses.length === 0 && !adding && (
            <div className="text-xs text-[#A69DC0] italic px-1">
              No expenses logged yet.
            </div>
          )}
          {activity.expenses.map((e) => {
            const cat = EXPENSE_CAT_STYLE[e.category] ?? EXPENSE_CAT_STYLE.other;
            const cents = e.amountCents ?? Math.round(Number(e.amount || 0) * 100);
            return (
              <div
                key={e.id}
                className="grid grid-cols-[92px_1fr_auto_auto] gap-2.5 items-center p-2.5 rounded-lg border border-[#E2DEEC] bg-white"
              >
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-center"
                  style={{ backgroundColor: cat.tint, color: cat.ink }}
                >
                  {cat.label}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#403770] truncate">
                    {e.description}
                  </div>
                  <div className="text-[11px] text-[#8A80A8] mt-0.5 flex items-center gap-1.5">
                    <span>{fmtShortDate(e.incurredOn)}</span>
                    {e.receiptStoragePath ? (
                      <span className="inline-flex items-center gap-1 text-[#69B34A]">
                        <Paperclip className="w-2.5 h-2.5" />
                        receipt
                      </span>
                    ) : (
                      <span className="text-[#997c43] font-medium">No receipt</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-[#403770] tabular-nums">
                  {fmtMoneyCents(cents)}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Remove expense: ${e.description}`}
                    onClick={() => handleRemove(e.id)}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[#A69DC0] hover:bg-[#fef1f0] hover:text-[#F37167] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add row / editor */}
        {!readOnly &&
          (adding ? (
            <ExpenseEditor onSave={handleAdd} onCancel={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-[#6E6390] border border-dashed border-[#C2BBD4] rounded-lg hover:bg-[#EFEDF5] hover:text-[#403770] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add expense
            </button>
          ))}
      </div>
    </div>
  );
}
