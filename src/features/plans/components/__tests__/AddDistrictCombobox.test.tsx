import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Hoist mock variables so they're available in vi.mock factory
const { mockMutate, mockUseDistrictNameSearch } = vi.hoisted(() => {
  const mockMutate = vi.fn();
  const mockUseDistrictNameSearch = vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
  });
  return { mockMutate, mockUseDistrictNameSearch };
});

vi.mock("@/features/plans/lib/queries", () => ({
  useDistrictNameSearch: mockUseDistrictNameSearch,
  useAddDistrictsToPlan: vi.fn().mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  }),
}));

import AddDistrictCombobox from "../AddDistrictCombobox";

const DISTRICT_1 = { leaid: "d1", name: "Jefferson County", stateAbbrev: "SC", enrollment: 12000, accountType: "Customer", owner: null };
const DISTRICT_2 = { leaid: "d2", name: "Jefferson Parish", stateAbbrev: "LA", enrollment: 45000, accountType: "Prospect", owner: null };

function renderCombobox(props?: Partial<React.ComponentProps<typeof AddDistrictCombobox>>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AddDistrictCombobox
        planId="plan-1"
        existingLeaids={new Set()}
        {...props}
      />
    </QueryClientProvider>
  );
}

/** Open the combobox and type a search query */
async function openAndType(query = "ab") {
  await userEvent.click(screen.getByRole("button", { name: /add district/i }));
  await userEvent.type(screen.getByRole("combobox"), query);
}

describe("AddDistrictCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDistrictNameSearch.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
  });

  it("renders the Add District button", () => {
    renderCombobox();
    expect(screen.getByRole("button", { name: /add district/i })).toBeInTheDocument();
  });

  it("shows search input when button is clicked", async () => {
    renderCombobox();
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows results when search returns data", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [DISTRICT_1, DISTRICT_2],
      isLoading: false,
    });

    renderCombobox();
    await openAndType();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Jefferson County");
    expect(options[1]).toHaveTextContent("Jefferson Parish");
  });

  it("shows 'In this plan' for existing districts", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [DISTRICT_1],
      isLoading: false,
    });

    renderCombobox({ existingLeaids: new Set(["d1"]) });
    await openAndType();

    expect(screen.getByText(/in this plan/i)).toBeInTheDocument();
  });

  it("calls mutate when a result is clicked", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [DISTRICT_1],
      isLoading: false,
    });

    renderCombobox();
    await openAndType();

    const option = screen.getByRole("option");
    await userEvent.click(option);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "plan-1",
        leaids: ["d1"],
      }),
      expect.any(Object),
    );
  });

  it("closes on Escape", async () => {
    renderCombobox();
    await userEvent.click(screen.getByRole("button", { name: /add district/i }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("does not call mutate when clicking an in-plan district", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [DISTRICT_1],
      isLoading: false,
    });

    renderCombobox({ existingLeaids: new Set(["d1"]) });
    await openAndType();

    const option = screen.getByRole("option");
    await userEvent.click(option);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("shows no-results message", async () => {
    mockUseDistrictNameSearch.mockReturnValue({
      data: [],
      isLoading: false,
    });

    renderCombobox();
    await openAndType("xyzabc");

    expect(screen.getByText(/no districts matching/i)).toBeInTheDocument();
  });
});
