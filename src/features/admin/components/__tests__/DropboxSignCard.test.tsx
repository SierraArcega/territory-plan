import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DropboxSignCard from "../DropboxSignCard";
import type { AdminIntegration } from "../../hooks/useAdminIntegrations";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeIntegration(overrides: Partial<AdminIntegration> = {}): AdminIntegration {
  return {
    name: "Dropbox Sign",
    slug: "dropbox-sign",
    status: "test",
    connectedUsers: null,
    totalUsers: null,
    lastSyncAt: null,
    description: "Sends contracts for e-signature via Dropbox Sign",
    modeChangedAt: null,
    modeChangedByName: null,
    ...overrides,
  };
}

function renderCard(integration: AdminIntegration) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DropboxSignCard integration={integration} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ key: "dropbox_sign_test_mode", value: true }) });
});

describe("DropboxSignCard", () => {
  it("shows the amber Test Mode pill and a checked switch in test mode", () => {
    renderCard(makeIntegration());
    expect(screen.getByText("Test Mode", { selector: "span.rounded-full" })).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("shows the green Live pill and an unchecked switch when live", () => {
    renderCard(makeIntegration({ status: "live" }));
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("requires confirmation before going live, then PATCHes value:false", async () => {
    renderCard(makeIntegration());
    fireEvent.click(screen.getByRole("switch"));
    // No request yet — the confirm panel is showing
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Going live/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go live" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/settings");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ key: "dropbox_sign_test_mode", value: false });
  });

  it("cancel dismisses the confirm without a request", () => {
    renderCard(makeIntegration());
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/Going live/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flips back to test mode instantly (no confirm)", async () => {
    renderCard(makeIntegration({ status: "live" }));
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ key: "dropbox_sign_test_mode", value: true });
    expect(screen.queryByText(/Going live/)).not.toBeInTheDocument();
  });

  it("shows an inline error when the PATCH fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    renderCard(makeIntegration({ status: "live" }));
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(screen.getByText(/Failed to update/)).toBeInTheDocument());
  });

  it("renders mode-change and last-send meta", () => {
    renderCard(makeIntegration({
      modeChangedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      modeChangedByName: "Aston Arcega",
      lastSyncAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    }));
    expect(screen.getByText(/Mode changed 2h ago by Aston Arcega/)).toBeInTheDocument();
    expect(screen.getByText(/Last send: 3d ago/)).toBeInTheDocument();
  });
});
