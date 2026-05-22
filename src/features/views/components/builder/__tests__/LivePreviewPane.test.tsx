import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import LivePreviewPane from "../LivePreviewPane";
import type { PreviewSpec } from "../../../lib/queries";

const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const baseSpec: PreviewSpec = {
  source: "districts",
  filterTree: { kind: "and", children: [] },
  scopeMode: "none",
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe("LivePreviewPane", () => {
  it("renders the eyebrow + count placeholder while loading", () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <LivePreviewPane
          spec={baseSpec}
          source="districts"
          scopeMode="none"
          scopeRefName={null}
        />
      </Wrapper>,
    );
    expect(getByText(/live preview/i)).toBeTruthy();
  });

  it("renders the match count once preview resolves", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve({
            count: 142,
            sample: [
              {
                id: "1",
                primaryLabel: "Mapleton ISD",
                secondaryLabel: "NY · 18,400 students",
                meta: "$92K pipeline",
              },
            ],
          }),
      }),
    );
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <LivePreviewPane
          spec={baseSpec}
          source="districts"
          scopeMode="none"
          scopeRefName={null}
        />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(getByText("142")).toBeTruthy();
    });
    expect(getByText(/Mapleton ISD/)).toBeTruthy();
  });

  it("renders the 'Scoped to' callout when scopeMode=reference", () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <LivePreviewPane
          spec={{ ...baseSpec, scopeMode: "reference" }}
          source="vacancies"
          scopeMode="reference"
          scopeRefName="Northeast Pod"
        />
      </Wrapper>,
    );
    expect(getByText(/scoped to/i)).toBeTruthy();
    expect(getByText(/northeast pod/i)).toBeTruthy();
  });

  it("uses singular 'match' when count === 1", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve({
            count: 1,
            sample: [
              {
                id: "1",
                primaryLabel: "Lone District",
                secondaryLabel: null,
                meta: null,
              },
            ],
          }),
      }),
    );
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <LivePreviewPane
          spec={baseSpec}
          source="districts"
          scopeMode="none"
          scopeRefName={null}
        />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(getByText(/districts match/i)).toBeTruthy();
    });
  });

  it("renders an error message when the preview fails", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Server Error",
        headers: new Headers(),
        text: () => Promise.resolve("boom"),
        json: () => Promise.reject(new Error("not json")),
        redirected: false,
      }),
    );
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <LivePreviewPane
          spec={baseSpec}
          source="districts"
          scopeMode="none"
          scopeRefName={null}
        />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(getByText(/couldn't preview/i)).toBeTruthy();
    });
  });
});
