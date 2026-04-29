import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExistingContactsModal from "../ExistingContactsModal";
import type { ContactSourcePlan } from "@/features/plans/lib/queries";

type UseContactSourcesResult = {
  data: { plans: ContactSourcePlan[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const mockRefetch = vi.fn();
let mockResult: UseContactSourcesResult = {
  data: { plans: [] },
  isLoading: false,
  isError: false,
  refetch: mockRefetch,
};

vi.mock("@/features/plans/lib/queries", () => ({
  useContactSources: () => mockResult,
}));

function renderModal(props: Partial<React.ComponentProps<typeof ExistingContactsModal>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const defaults = {
    planId: "plan-1",
    variant: "queued-zero" as const,
    districtCount: 3,
    onClose: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ExistingContactsModal {...merged} />
    </QueryClientProvider>
  );
  return { ...utils, onClose: merged.onClose, queryClient };
}

function makePlan(overrides: Partial<ContactSourcePlan> = {}): ContactSourcePlan {
  return {
    id: "plan-x",
    name: "Default Plan",
    ownerName: "Aston",
    sharedDistrictCount: 2,
    contactCount: 5,
    lastEnrichedAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExistingContactsModal", () => {
  beforeEach(() => {
    mockRefetch.mockClear();
    mockResult = {
      data: { plans: [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
  });

  it("renders queued-zero variant with title and subline", () => {
    renderModal({ variant: "queued-zero", districtCount: 3 });
    expect(screen.getByRole("heading", { name: /contacts already exist/i })).toBeInTheDocument();
    expect(
      screen.getByText(/contacts for 3 districts in this plan are already in the system/i)
    ).toBeInTheDocument();
  });

  it("renders partial variant with status line and skipped message", () => {
    renderModal({ variant: "partial", districtCount: 2, newCount: 4 });
    expect(screen.getByRole("heading", { name: /enrichment complete/i })).toBeInTheDocument();
    expect(screen.getByText(/found 4 new contacts for 4 districts\./i)).toBeInTheDocument();
    expect(screen.getByText(/2 districts already had contacts/i)).toBeInTheDocument();
  });

  it("renders 3 skeleton rows in loading state", () => {
    mockResult = { data: undefined, isLoading: true, isError: false, refetch: mockRefetch };
    renderModal();
    const skeletons = screen.getAllByTestId("contact-sources-skeleton");
    expect(skeletons).toHaveLength(3);
  });

  it("renders empty state when plans: []", () => {
    mockResult = {
      data: { plans: [] },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderModal();
    expect(
      screen.getByText(/no other plans contain these districts yet/i)
    ).toBeInTheDocument();
  });

  it("renders error state with Retry that re-fetches", () => {
    mockResult = { data: undefined, isLoading: false, isError: true, refetch: mockRefetch };
    renderModal();
    expect(screen.getByText(/couldn't load other plans/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders first 3 plan rows by default and expands via See all", () => {
    const plans = Array.from({ length: 5 }, (_, i) =>
      makePlan({ id: `plan-${i}`, name: `Plan ${i}` })
    );
    mockResult = {
      data: { plans },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderModal();
    expect(screen.getByText("Plan 0")).toBeInTheDocument();
    expect(screen.getByText("Plan 2")).toBeInTheDocument();
    expect(screen.queryByText("Plan 3")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /see all 5/i }));
    expect(screen.getByText("Plan 3")).toBeInTheDocument();
    expect(screen.getByText("Plan 4")).toBeInTheDocument();
  });

  it("'Show them here' invalidates planContacts query and calls onClose", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ExistingContactsModal
          planId="plan-42"
          variant="queued-zero"
          districtCount={2}
          onClose={onClose}
        />
      </QueryClientProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /show them here/i }));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["planContacts", "plan-42"] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape key calls onClose", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop click calls onClose", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("plan row renders as native anchor with /plans/{id} href", () => {
    const plans = [makePlan({ id: "plan-99", name: "Anchor Plan" })];
    mockResult = {
      data: { plans },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    };
    renderModal();
    const link = screen.getByRole("link", { name: /anchor plan/i });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/plans/plan-99");
  });
});
