"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import FieldLabel from "@/features/shared/components/FieldLabel";
import {
  VALID_EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/features/activities/types";

export interface ExpenseEditorInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  incurredOn: string; // ISO date
  receiptStoragePath?: string | null;
}

interface ExpenseEditorProps {
  onSave: (input: ExpenseEditorInput) => void;
  onCancel: () => void;
}

const CAT_LABELS: Record<ExpenseCategory, string> = {
  travel: "Travel",
  meals: "Meals",
  lodging: "Lodging",
  swag: "Swag",
  other: "Other",
};

function todayDateInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const inputCls =
  "w-full px-2.5 py-1.5 text-sm border border-[#C2BBD4] rounded-md bg-white text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] tabular-nums";

export default function ExpenseEditor({ onSave, onCancel }: ExpenseEditorProps) {
  const [category, setCategory] = useState<ExpenseCategory>("meals");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayDateInputValue());
  const [receipt, setReceipt] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSave = description.trim().length > 0 && Number(amount) > 0;

  function handleSave() {
    if (!canSave) return;
    // TODO: upload receipt via /api/activities/[id]/expenses/[expenseId]/receipt
    // after the expense is created. For Wave 5e we capture the local File but
    // don't upload — receiptStoragePath stays undefined and missing-receipt
    // pill correctly counts the new row.
    onSave({
      category,
      description: description.trim(),
      amount: Number(amount),
      incurredOn: new Date(date).toISOString(),
      receiptStoragePath: undefined,
    });
  }

  return (
    <div className="p-3.5 rounded-[10px] border border-[#403770] bg-white shadow-[0_4px_12px_rgba(64,55,112,0.08)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#403770] mb-2.5">
        New expense
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <FieldLabel htmlFor="expense-category">Category</FieldLabel>
          <select
            id="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className={inputCls}
          >
            {VALID_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CAT_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="expense-amount">Amount</FieldLabel>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A69DC0] text-sm pointer-events-none">
              $
            </span>
            <input
              id="expense-amount"
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${inputCls} pl-5`}
            />
          </div>
        </div>
      </div>
      <div className="mt-2.5">
        <FieldLabel htmlFor="expense-description">Description</FieldLabel>
        <input
          id="expense-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Coffee with Westfield ISD principal"
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
        <div>
          <FieldLabel htmlFor="expense-date">Date</FieldLabel>
          <input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <FieldLabel optional>Receipt</FieldLabel>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            hidden
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#6E6390] border border-[#C2BBD4] bg-white rounded-md hover:bg-[#F7F5FA] truncate"
          >
            <Paperclip className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{receipt ? receipt.name : "Attach receipt"}</span>
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-[#6E6390] border border-[#E2DEEC] bg-white rounded-md hover:bg-[#F7F5FA]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save expense
        </button>
      </div>
    </div>
  );
}
