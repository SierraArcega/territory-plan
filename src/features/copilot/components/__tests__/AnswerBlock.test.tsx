import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnswerBlock } from "../AnswerBlock";
import { downloadCsv } from "@/features/reports/lib/csv";

// Keep rowsToCsv / slugifyForFilename real so we can assert on the produced CSV
// and filename; only stub the DOM download side-effect.
vi.mock("@/features/reports/lib/csv", async (importActual) => {
  const actual = await importActual<typeof import("@/features/reports/lib/csv")>();
  return { ...actual, downloadCsv: vi.fn() };
});

describe("AnswerBlock", () => {
  it("hides id columns and shows the View-on-map button when leaids are present", () => {
    const onViewOnMap = vi.fn();
    render(
      <AnswerBlock
        answer={{ columns: ["leaid", "name"], rows: [{ leaid: "1900001", name: "Lake Mills" }], rowCount: 1 }}
        onViewOnMap={onViewOnMap}
      />,
    );
    expect(screen.queryByText("leaid")).toBeNull();
    expect(screen.getByText("name")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /view .* on the map/i }));
    expect(onViewOnMap).toHaveBeenCalledTimes(1);
  });

  it("shows no map button when there is no leaid column", () => {
    render(
      <AnswerBlock
        answer={{ columns: ["name"], rows: [{ name: "Lake Mills" }], rowCount: 1 }}
        onViewOnMap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /view .* on the map/i })).toBeNull();
  });

  it("shows an Export CSV button when there is a visible table with rows", () => {
    render(
      <AnswerBlock
        answer={{ columns: ["name", "pipeline"], rows: [{ name: "Lake Mills", pipeline: 1000 }], rowCount: 1 }}
        onViewOnMap={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /export csv/i })).toBeTruthy();
  });

  it("hides the Export CSV button when there are no rows", () => {
    render(
      <AnswerBlock
        answer={{ columns: ["name"], rows: [], rowCount: 0 }}
        onViewOnMap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /export csv/i })).toBeNull();
  });

  it("hides the Export CSV button for map-only answers (no rep-facing columns)", () => {
    render(
      <AnswerBlock
        answer={{ columns: ["leaid"], rows: [{ leaid: "1900001" }], rowCount: 1 }}
        onViewOnMap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /export csv/i })).toBeNull();
  });

  it("exports rep-facing columns only and the full row set, not just the 50 shown", () => {
    vi.mocked(downloadCsv).mockClear();
    const rows = Array.from({ length: 60 }, (_, i) => ({
      leaid: String(1900000 + i),
      name: `District ${i}`,
    }));
    render(
      <AnswerBlock
        answer={{ columns: ["leaid", "name"], rows, rowCount: 60 }}
        onViewOnMap={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const csv = vi.mocked(downloadCsv).mock.calls[0][1];
    const lines = csv.trimEnd().split("\n");
    // Header excludes the id column; rep-facing only.
    expect(lines[0]).toBe("name");
    expect(csv).not.toContain("leaid");
    // 1 header + 60 data rows — the full set, even though only 50 render.
    expect(lines).toHaveLength(61);
  });

  it("derives the CSV filename from the answer source", () => {
    vi.mocked(downloadCsv).mockClear();
    render(
      <AnswerBlock
        answer={{
          columns: ["name"],
          rows: [{ name: "Lake Mills" }],
          rowCount: 1,
          source: "My Open Opps",
        }}
        onViewOnMap={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadCsv).mock.calls[0][0]).toBe("my-open-opps");
  });
});
