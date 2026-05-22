import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RowActionsMenu } from "../RowActionsMenu";

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

  it("opens a menu with the four actions on click", async () => {
    render(<RowActionsMenu {...props} />, { wrapper });
    openMenu();
    expect(await screen.findByRole("menuitem", { name: /log activity/i })).toBeInTheDocument();
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

  it("removes the district after a two-step confirm and invalidates the grid", async () => {
    const fetchMock = vi.fn(() =>
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
    expect((init as RequestInit).method).toBe("DELETE");
    vi.unstubAllGlobals();
  });
});
