import { describe, it, expect } from "vitest";
import { DEFAULT_PAGE_SIZE, pageMeta } from "../grid-pagination";

describe("pageMeta", () => {
  it("page size constant is 50", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it("first page of a multi-page result reports the 1-based row range", () => {
    expect(pageMeta(738, 1, 50)).toEqual({
      page: 1,
      pageCount: 15,
      from: 1,
      to: 50,
      total: 738,
    });
  });

  it("last page reports a partial row range (fewer than pageSize rows)", () => {
    // 738 / 50 = 14 full pages + 38 rows on page 15 (rows 701–738).
    expect(pageMeta(738, 15, 50)).toEqual({
      page: 15,
      pageCount: 15,
      from: 701,
      to: 738,
      total: 738,
    });
  });

  it("clamps a page above the last page back to the last page", () => {
    expect(pageMeta(738, 99, 50)).toMatchObject({ page: 15, from: 701, to: 738 });
  });

  it("clamps a page below 1 up to page 1", () => {
    expect(pageMeta(738, 0, 50)).toMatchObject({ page: 1, from: 1, to: 50 });
  });

  it("an exact multiple of pageSize yields a full final page (no overhang page)", () => {
    expect(pageMeta(100, 2, 50)).toEqual({
      page: 2,
      pageCount: 2,
      from: 51,
      to: 100,
      total: 100,
    });
  });

  it("a total equal to one page yields a single page", () => {
    expect(pageMeta(50, 1, 50)).toEqual({
      page: 1,
      pageCount: 1,
      from: 1,
      to: 50,
      total: 50,
    });
  });

  it("one row over a page boundary creates a second page with a single row", () => {
    expect(pageMeta(51, 2, 50)).toEqual({
      page: 2,
      pageCount: 2,
      from: 51,
      to: 51,
      total: 51,
    });
  });

  it("a zero-row result reports an empty range and a single (empty) page", () => {
    expect(pageMeta(0, 1, 50)).toEqual({
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
      total: 0,
    });
  });
});
