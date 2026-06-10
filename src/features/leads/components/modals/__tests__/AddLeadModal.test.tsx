import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";

const createMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useCreateLeadMutation: () => ({ mutate: createMock, isPending: false }),
    useDistrictSchoolsQuery: () => ({
      data: [{ ncessch: "080294000123", schoolName: "Mesa Ridge Middle", schoolLevel: "Middle" }],
      isLoading: false,
    }),
  };
});

vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: { id: "me-1", fullName: "Sierra Arcega" } }),
  useUsers: () => ({
    data: [
      { id: "me-1", fullName: "Sierra Arcega", avatarUrl: null, email: "s@x.com", jobTitle: null },
      { id: "u2", fullName: "Alex Rivera", avatarUrl: null, email: "a@x.com", jobTitle: null },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/features/plans/lib/queries", () => ({
  useDistrictNameSearch: (query: string) => ({
    data:
      query.length >= 2
        ? [
            {
              leaid: "0802940",
              name: "Mesa Valley USD 51",
              stateAbbrev: "CO",
              enrollment: 21000,
              accountType: null,
              owner: null,
            },
          ]
        : undefined,
    isLoading: false,
  }),
}));

import AddLeadModal from "../AddLeadModal";

function renderModal() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <ToastProvider>
      <AddLeadModal onClose={onClose} onCreated={onCreated} />
    </ToastProvider>,
  );
  return { onClose, onCreated };
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Karen" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Whitfield" } });
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Director of Special Education" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "kwhitfield@mvusd51.org" },
  });
  fireEvent.change(screen.getByLabelText("Search districts"), {
    target: { value: "Mesa" },
  });
  fireEvent.mouseDown(screen.getByText("Mesa Valley USD 51"));
}

describe("AddLeadModal", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("blocks submit and flags missing required fields", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Add & assign/ }));
    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByText("Fill in the required fields to continue.")).toBeTruthy();
  });

  it("creates the lead with the picked district and defaults (current-user BDR, 100 score)", () => {
    renderModal();
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /Add & assign/ }));
    expect(createMock).toHaveBeenCalledWith(
      {
        leaid: "0802940",
        schoolNcessch: null,
        contactName: "Karen Whitfield",
        contactTitle: "Director of Special Education",
        email: "kwhitfield@mvusd51.org",
        phone: null,
        leadType: "mql",
        sequence: "Superintendent — Special Ed",
        marketingOwner: null,
        assignedBdrId: "me-1",
        score: 100,
      },
      expect.anything(),
    );
  });

  it("joins salutation into the contact name and honors an explicit score", () => {
    renderModal();
    fillRequired();
    fireEvent.change(screen.getByLabelText("Salutation"), { target: { value: "Dr." } });
    fireEvent.change(screen.getByLabelText("Engagement score"), { target: { value: "138" } });
    fireEvent.click(screen.getByRole("button", { name: /Add & assign/ }));
    const input = createMock.mock.calls[0][0];
    expect(input.contactName).toBe("Dr. Karen Whitfield");
    expect(input.score).toBe(138);
  });

  it("auto-selects the created lead (create-and-add)", () => {
    const { onCreated } = renderModal();
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /Add & assign/ }));
    const created = { id: "new-lead" };
    act(() => createMock.mock.calls[0][1].onSuccess(created));
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("surfaces the server error message inline (409 active lead)", () => {
    renderModal();
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /Add & assign/ }));
    act(() =>
      createMock.mock.calls[0][1].onError(new Error("409: Contact already has an active lead")),
    );
    expect(screen.getByText("Contact already has an active lead")).toBeTruthy();
  });

  it("passes the chosen school's NCES id", () => {
    renderModal();
    fillRequired();
    fireEvent.change(screen.getByLabelText("School"), { target: { value: "080294000123" } });
    fireEvent.click(screen.getByRole("button", { name: /Add & assign/ }));
    expect(createMock.mock.calls[0][0].schoolNcessch).toBe("080294000123");
  });
});
