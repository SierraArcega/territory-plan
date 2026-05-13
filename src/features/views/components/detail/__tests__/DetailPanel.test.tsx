/**
 * DetailPanel shell — open/close behavior tests.
 *
 * Scope:
 *   - When the URL has no ?detail param, DetailPanel renders nothing.
 *   - When ?detail=opp:abc is present, the panel mounts and dispatches to
 *     OppDetailContent.
 *   - Clicking the X button calls closeDetail (asserted via the spy on the
 *     mocked useViewsRouter).
 *   - Clicking outside the panel (on a plain element) calls closeDetail.
 *   - Clicking inside the panel does NOT call closeDetail.
 *   - Clicking on a [data-row-kind][data-row-id] element does NOT close —
 *     the GroupCanvas handles the URL swap instead.
 *   - Pressing Escape closes the panel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import DetailPanel from "../DetailPanel";

const closeDetailSpy = vi.fn();
const useViewsRouterMock = vi.fn();

vi.mock("../../../hooks/useViewsRouter", () => ({
  useViewsRouter: () => useViewsRouterMock(),
}));

// Never let the content fetch — every content component renders the skeleton.
const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  closeDetailSpy.mockReset();
  useViewsRouterMock.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => new Promise(() => undefined));
});

describe("DetailPanel", () => {
  it("renders nothing when detail is null", () => {
    useViewsRouterMock.mockReturnValue({
      detail: null,
      closeDetail: closeDetailSpy,
    });
    const { container } = render(<DetailPanel />, { wrapper: makeWrapper() });
    // No panel role anywhere in the DOM.
    expect(container.querySelector('[role="complementary"]')).toBeNull();
  });

  it("renders the panel when detail is set, dispatches by kind", () => {
    useViewsRouterMock.mockReturnValue({
      detail: { kind: "opp", id: "opp_1" },
      closeDetail: closeDetailSpy,
    });
    const { container } = render(<DetailPanel />, { wrapper: makeWrapper() });
    const panel = container.querySelector('[role="complementary"]');
    expect(panel).not.toBeNull();
    // The Opp header eyebrow text confirms we dispatched to OppDetailContent.
    expect(container.textContent).toContain("Opportunity");
  });

  it("calls closeDetail when the X button is clicked", () => {
    useViewsRouterMock.mockReturnValue({
      detail: { kind: "opp", id: "opp_1" },
      closeDetail: closeDetailSpy,
    });
    const { container } = render(<DetailPanel />, { wrapper: makeWrapper() });
    const closeBtn = container.querySelector(
      'button[aria-label="Close detail panel"]',
    );
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    expect(closeDetailSpy).toHaveBeenCalledTimes(1);
  });

  it("closes when clicking outside the panel", () => {
    useViewsRouterMock.mockReturnValue({
      detail: { kind: "opp", id: "opp_1" },
      closeDetail: closeDetailSpy,
    });
    // Mount DetailPanel + a sibling "outside" element. We dispatch a
    // document-level mousedown so the panel's effect handler fires.
    const { container } = render(
      <div>
        <button data-testid="outside-target">outside</button>
        <DetailPanel />
      </div>,
      { wrapper: makeWrapper() },
    );
    const outside = container.querySelector(
      '[data-testid="outside-target"]',
    ) as HTMLElement;
    fireEvent.mouseDown(outside);
    expect(closeDetailSpy).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the panel", () => {
    useViewsRouterMock.mockReturnValue({
      detail: { kind: "opp", id: "opp_1" },
      closeDetail: closeDetailSpy,
    });
    const { container } = render(<DetailPanel />, { wrapper: makeWrapper() });
    const panel = container.querySelector('[role="complementary"]') as HTMLElement;
    fireEvent.mouseDown(panel);
    expect(closeDetailSpy).not.toHaveBeenCalled();
  });

  it("does not close when clicking a data-row-kind element (canvas handles it)", () => {
    useViewsRouterMock.mockReturnValue({
      detail: { kind: "opp", id: "opp_1" },
      closeDetail: closeDetailSpy,
    });
    const { container } = render(
      <div>
        <div data-row-kind="contact" data-row-id="42" data-testid="row-target">
          row
        </div>
        <DetailPanel />
      </div>,
      { wrapper: makeWrapper() },
    );
    const row = container.querySelector('[data-testid="row-target"]') as HTMLElement;
    fireEvent.mouseDown(row);
    expect(closeDetailSpy).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    useViewsRouterMock.mockReturnValue({
      detail: { kind: "opp", id: "opp_1" },
      closeDetail: closeDetailSpy,
    });
    render(<DetailPanel />, { wrapper: makeWrapper() });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeDetailSpy).toHaveBeenCalledTimes(1);
  });
});
