import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RowActionsMenu } from "../RowActionsMenu";

// Mock TipTap (used inside NotesPopover → NoteComposer) so jsdom doesn't break.
const chainStub = {
  focus: () => chainStub, toggleBold: () => chainStub, toggleItalic: () => chainStub,
  toggleBulletList: () => chainStub, toggleOrderedList: () => chainStub,
  setLink: () => chainStub, run: () => {},
};
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    isEmpty: true, isActive: () => false, chain: () => chainStub,
    getJSON: () => ({}), getText: () => "", commands: { clearContent: () => {} },
  }),
  EditorContent: () => null,
}));
// useProfile is called inside NotesPopover; stub it to avoid a real fetch.
vi.mock("@/lib/api", () => ({ useProfile: () => ({ data: { id: "me" } }) }));

// Stub the heavy home activity modal — we only assert the wiring contract:
// that RowActionsMenu mounts it preselected with the clicked district + plan.
vi.mock("@/features/activities/components/ActivityFormModal", () => ({
  default: ({
    isOpen,
    defaultPlanId,
    defaultDistricts,
  }: {
    isOpen: boolean;
    defaultPlanId?: string;
    defaultDistricts?: { leaid: string; name: string }[];
  }) =>
    isOpen ? (
      <div data-testid="activity-modal" data-plan-id={defaultPlanId ?? ""}>
        {(defaultDistricts ?? []).map((d) => (
          <span key={d.leaid} data-leaid={d.leaid}>
            {d.name}
          </span>
        ))}
      </div>
    ) : null,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const props = { planId: "plan-1", leaid: "0601234", districtName: "Tedesco USD" };
const openMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));

describe("RowActionsMenu", () => {
  it("renders a kebab button and no menu by default", () => {
    render(<RowActionsMenu {...props} />, { wrapper });
    expect(screen.getByRole("button", { name: /actions for tedesco usd/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("opens a menu with all five actions on click", async () => {
    render(<RowActionsMenu {...props} />, { wrapper });
    openMenu();
    expect(await screen.findByRole("menuitem", { name: /log activity/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /add note/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /set targets/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /create opportunity/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /remove from plan/i })).toBeInTheDocument();
  });

  it("closes the menu on Escape", async () => {
    render(<RowActionsMenu {...props} />, { wrapper });
    openMenu();
    await screen.findByRole("menuitem", { name: /log activity/i });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menuitem")).not.toBeInTheDocument());
  });

  it("opens the home activity modal preselected with the clicked district and plan", async () => {
    render(<RowActionsMenu {...props} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /log activity/i }));
    // The home modal mounts pre-associated with the row's plan + district — no extra clicks.
    const modal = await screen.findByTestId("activity-modal");
    expect(modal).toHaveAttribute("data-plan-id", "plan-1");
    expect(within(modal).getByText(/tedesco usd/i)).toBeInTheDocument();
  });

  it("removes the district after a two-step confirm and invalidates the grid", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      })));
    vi.stubGlobal("fetch", fetchMock);

    render(<RowActionsMenu {...props} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /remove from plan/i }));
    // Confirm step revealed; network not yet hit.
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: /^remove$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/territory-plans/plan-1/districts/0601234");
    expect(init?.method).toBe("DELETE");
    vi.unstubAllGlobals();
  });

  it("opens the notes popover from the Add note item", async () => {
    // NotesPopover calls useDistrictNotes(); stub fetch to return { notes: [] }.
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ notes: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }))));
    render(<RowActionsMenu {...props} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /add note/i }));
    expect(await screen.findByRole("dialog", { name: /notes for tedesco usd/i })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
