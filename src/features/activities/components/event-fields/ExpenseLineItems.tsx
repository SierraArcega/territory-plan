"use client";

interface Expense {
  description: string;
  amount: number;
}

interface ExpenseLineItemsProps {
  expenses: Expense[];
  onChange: (expenses: Expense[]) => void;
}

export default function ExpenseLineItems({ expenses, onChange }: ExpenseLineItemsProps) {
  const addRow = () => {
    onChange([...expenses, { description: "", amount: 0 }]);
  };

  const removeRow = (index: number) => {
    onChange(expenses.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof Expense, value: string | number) => {
    const updated = expenses.map((e, i) =>
      i === index ? { ...e, [field]: value } : e
    );
    onChange(updated);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-[#8A80A8] mb-1">
        Expenses
      </label>
      <div className="space-y-2">
        {expenses.map((expense, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={expense.description}
              onChange={(e) => updateRow(i, "description", e.target.value)}
              placeholder="Description"
              className="flex-1 px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
            />
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0] text-sm">$</span>
              <input
                type="number"
                value={expense.amount || ""}
                onChange={(e) => updateRow(i, "amount", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-7 pr-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="p-1.5 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 text-xs text-[#403770] hover:text-[#322a5a] font-medium"
      >
        + Add expense
      </button>
    </div>
  );
}
