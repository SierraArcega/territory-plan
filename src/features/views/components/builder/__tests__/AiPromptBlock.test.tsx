import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import type { ListSpec } from "@/lib/saved-views/filter-tree";
import type { AiListBuilderEvent } from "../../../lib/ai-list-builder/client";

// Mock the SSE client *before* importing the component so the import inside
// AiPromptBlock binds to the mocked symbol.
const streamMock = vi.fn();
vi.mock("../../../lib/ai-list-builder/client", () => ({
  streamAiListBuilder: (args: { prompt: string; signal?: AbortSignal }) =>
    streamMock(args),
}));

// eslint-disable-next-line import/first
import AiPromptBlock from "../AiPromptBlock";

/** Helper to build an async iterator from a fixed event sequence. */
function makeEventStream(
  events: AiListBuilderEvent[],
): AsyncGenerator<AiListBuilderEvent, void, void> {
  let i = 0;
  return {
    async next() {
      if (i >= events.length) return { value: undefined, done: true };
      return { value: events[i++], done: false };
    },
    async return() {
      return { value: undefined, done: true };
    },
    async throw() {
      return { value: undefined, done: true };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  } as AsyncGenerator<AiListBuilderEvent, void, void>;
}

beforeEach(() => {
  streamMock.mockReset();
});

const stubSpec: ListSpec = {
  schemaVersion: 1,
  source: "districts",
  filterTree: { kind: "and", children: [] },
  scope: { mode: "none" },
};

describe("AiPromptBlock", () => {
  it("renders the prompt input + Build button + 4 chips", () => {
    const { getByLabelText, getByText, getAllByRole } = render(
      <AiPromptBlock onSuccess={vi.fn()} />,
    );
    expect(getByLabelText(/ai prompt/i)).toBeTruthy();
    expect(getByText(/^build$/i)).toBeTruthy();
    // chips render as buttons under the input — count them by aria role.
    const chips = getAllByRole("button").filter((b) =>
      /(news at northeast|vacancies in iowa|open rfps|champions i)/i.test(
        b.textContent ?? "",
      ),
    );
    expect(chips).toHaveLength(4);
  });

  it("disables Build when the prompt is empty", () => {
    const { getByText } = render(<AiPromptBlock onSuccess={vi.fn()} />);
    const btn = getByText(/^build$/i) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("calls onSuccess when the stream yields an 'ok' result", async () => {
    streamMock.mockImplementation(() =>
      makeEventStream([
        { kind: "trace", payload: { step: 1 } },
        { kind: "ok", listSpec: stubSpec, name: "Test list" },
      ]),
    );
    const onSuccess = vi.fn();
    const { getByLabelText, getByText } = render(
      <AiPromptBlock onSuccess={onSuccess} />,
    );
    fireEvent.change(getByLabelText(/ai prompt/i), {
      target: { value: "Vacancies in Iowa" },
    });
    fireEvent.click(getByText(/^build$/i));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onSuccess).toHaveBeenCalledWith({
      listSpec: stubSpec,
      name: "Test list",
    });
  });

  it("renders the clarifying text when the stream yields 'clarifying'", async () => {
    streamMock.mockImplementation(() =>
      makeEventStream([
        { kind: "clarifying", text: "Did you mean Iowa or Indiana?" },
      ]),
    );
    const { getByLabelText, getByText, findByText } = render(
      <AiPromptBlock onSuccess={vi.fn()} />,
    );
    fireEvent.change(getByLabelText(/ai prompt/i), {
      target: { value: "Vacancies in IA" },
    });
    fireEvent.click(getByText(/^build$/i));
    expect(await findByText(/did you mean iowa or indiana/i)).toBeTruthy();
  });

  it("renders the error notice when the stream yields 'error'", async () => {
    streamMock.mockImplementation(() =>
      makeEventStream([{ kind: "error", error: "model exploded" }]),
    );
    const { getByLabelText, getByText, findByText } = render(
      <AiPromptBlock onSuccess={vi.fn()} />,
    );
    fireEvent.change(getByLabelText(/ai prompt/i), {
      target: { value: "anything" },
    });
    fireEvent.click(getByText(/^build$/i));
    expect(await findByText(/couldn't generate/i)).toBeTruthy();
  });

  it("clicking a suggested chip fills the prompt and auto-submits", async () => {
    streamMock.mockImplementation(() =>
      makeEventStream([
        { kind: "ok", listSpec: stubSpec, name: "From chip" },
      ]),
    );
    const onSuccess = vi.fn();
    const { getByText } = render(<AiPromptBlock onSuccess={onSuccess} />);
    fireEvent.click(getByText(/vacancies in iowa districts/i));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        listSpec: stubSpec,
        name: "From chip",
      });
    });
    expect(streamMock).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "Vacancies in Iowa districts" }),
    );
  });

  it("renders the externalNotice amber slot when provided", () => {
    const { getByText } = render(
      <AiPromptBlock
        onSuccess={vi.fn()}
        externalNotice="Some advanced logic was simplified — review conditions"
      />,
    );
    expect(getByText(/some advanced logic was simplified/i)).toBeTruthy();
  });

  it("does not auto-retry when the stream errors", async () => {
    streamMock.mockImplementation(() =>
      makeEventStream([{ kind: "error", error: "boom" }]),
    );
    const { getByLabelText, getByText, findByText } = render(
      <AiPromptBlock onSuccess={vi.fn()} />,
    );
    fireEvent.change(getByLabelText(/ai prompt/i), {
      target: { value: "x" },
    });
    fireEvent.click(getByText(/^build$/i));
    await findByText(/couldn't generate/i);
    expect(streamMock).toHaveBeenCalledTimes(1);
  });
});
