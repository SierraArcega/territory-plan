import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/activities/lib/queries", () => ({
  useCreateActivityExpense: vi.fn(),
  useDeleteActivityExpense: vi.fn(),
}));

import {
  useCreateActivityExpense,
  useDeleteActivityExpense,
} from "@/features/activities/lib/queries";
import ExpensesPanel from "../ExpensesPanel";
import type { Activity } from "@/features/shared/types/api-types";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    type: "discovery_call",
    category: "meetings",
    title: "Test",
    notes: null,
    startDate: null,
    endDate: null,
    status: "planned",
    createdByUserId: "user-1",
    createdByUser: null,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    googleEventId: null,
    source: "manual",
    outcome: null,
    outcomeType: null,
    sentiment: null,
    nextStep: null,
    followUpDate: null,
    dealImpact: "none",
    outcomeDisposition: null,
    address: null,
    addressLat: null,
    addressLng: null,
    inPerson: null,
    metadata: null,
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    plans: [],
    districts: [],
    contacts: [],
    states: [],
    expenses: [],
    attendees: [],
    relatedActivities: [],
    opportunities: [],
    rating: null,
    ...overrides,
  };
}

describe("ExpensesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCreateActivityExpense as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useDeleteActivityExpense as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
    });
  });

  it("renders $0.00 total and Add expense button when no expenses", () => {
    render(
      <ExpensesPanel activity={makeActivity()} readOnly={false} onSaved={vi.fn()} />
    );
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add expense/i })).toBeInTheDocument();
  });

  it("MissingReceiptPill shows '1 missing receipt' when one expense lacks receipt", () => {
    render(
      <ExpensesPanel
        activity={makeActivity({
          expenses: [
            {
              id: "e1",
              description: "Lunch",
              amount: 30,
              amountCents: 3000,
              category: "meals",
              incurredOn: "2026-04-27T00:00:00.000Z",
              receiptStoragePath: null,
              createdById: "user-1",
            },
          ],
        })}
        readOnly={false}
      />
    );
    expect(screen.getByText(/1 missing receipt/i)).toBeInTheDocument();
  });

  it("opens the editor and dispatches create on Save", () => {
    const mutate = vi.fn();
    (useCreateActivityExpense as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate,
      isPending: false,
    });
    render(
      <ExpensesPanel activity={makeActivity()} readOnly={false} onSaved={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /add expense/i }));
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Coffee" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /save expense/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0];
    expect(vars.activityId).toBe("act-1");
    expect(vars.expense.description).toBe("Coffee");
    expect(vars.expense.amount).toBe(5);
    expect(vars.expense.category).toBe("meals");
  });

  it("hides the Add button when readOnly", () => {
    render(<ExpensesPanel activity={makeActivity()} readOnly />);
    expect(screen.queryByRole("button", { name: /add expense/i })).not.toBeInTheDocument();
  });
});
