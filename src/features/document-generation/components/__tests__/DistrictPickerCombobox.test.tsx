import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseDistrictNameSearch } = vi.hoisted(() => ({
  mockUseDistrictNameSearch: vi.fn().mockReturnValue({ data: undefined, isLoading: false }),
}));

vi.mock("@/features/plans/lib/queries", () => ({
  useDistrictNameSearch: mockUseDistrictNameSearch,
}));

import DistrictPickerCombobox from "../DistrictPickerCombobox";

const DISTRICT_1 = { leaid: "0601234", name: "Jefferson County", stateAbbrev: "SC", enrollment: 12000, accountType: "Customer", owner: null };
const DISTRICT_2 = { leaid: "2204567", name: "Jefferson Parish", stateAbbrev: "LA", enrollment: 45000, accountType: null, owner: null };

function renderPicker(props?: Partial<React.ComponentProps<typeof DistrictPickerCombobox>>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = props?.onSelect ?? vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <DistrictPickerCombobox onSelect={onSelect} {...props} />
    </QueryClientProvider>
  );
  return { ...utils, onSelect };
}

describe("DistrictPickerCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDistrictNameSearch.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("renders a search input", () => {
    renderPicker();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows matching districts once a query is typed", async () => {
    mockUseDistrictNameSearch.mockReturnValue({ data: [DISTRICT_1, DISTRICT_2], isLoading: false });
    renderPicker();
    await userEvent.type(screen.getByRole("combobox"), "jeff");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Jefferson County");
  });

  it("calls onSelect with the chosen district when a result is clicked", async () => {
    mockUseDistrictNameSearch.mockReturnValue({ data: [DISTRICT_1], isLoading: false });
    const { onSelect } = renderPicker();
    await userEvent.type(screen.getByRole("combobox"), "jeff");
    await userEvent.click(screen.getByRole("option"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ leaid: "0601234", name: "Jefferson County" }));
  });

  it("shows a no-results message when the search returns nothing", async () => {
    mockUseDistrictNameSearch.mockReturnValue({ data: [], isLoading: false });
    renderPicker();
    await userEvent.type(screen.getByRole("combobox"), "zzzzz");
    expect(screen.getByText(/no districts matching/i)).toBeInTheDocument();
  });

  it("does not show the results dropdown for queries under 2 characters", async () => {
    mockUseDistrictNameSearch.mockReturnValue({ data: [DISTRICT_1], isLoading: false });
    renderPicker();
    await userEvent.type(screen.getByRole("combobox"), "j");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
