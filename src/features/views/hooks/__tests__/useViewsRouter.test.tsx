import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { __test, useViewsRouter } from "../useViewsRouter";

// Shared mock state — each test resets via beforeEach.
const mockState = {
  pathname: "/views",
  searchParams: new URLSearchParams(""),
  push: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockState.push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => mockState.pathname,
  useSearchParams: () => mockState.searchParams,
}));

beforeEach(() => {
  mockState.pathname = "/views";
  mockState.searchParams = new URLSearchParams("");
  mockState.push.mockReset();
});

describe("parsePath (pure)", () => {
  const { parsePath } = __test;

  it("treats /views as portfolio", () => {
    expect(parsePath("/views")).toEqual({
      groupKind: null,
      groupId: null,
      viewId: null,
    });
  });

  it("parses plan with default view (no viewId segment)", () => {
    expect(parsePath("/views/plans/plan-abc")).toEqual({
      groupKind: "plan",
      groupId: "plan-abc",
      viewId: null,
    });
  });

  it("parses plan + specific view", () => {
    expect(parsePath("/views/plans/plan-abc/map")).toEqual({
      groupKind: "plan",
      groupId: "plan-abc",
      viewId: "map",
    });
  });

  it("parses list + specific view", () => {
    expect(parsePath("/views/lists/list-xyz/table")).toEqual({
      groupKind: "list",
      groupId: "list-xyz",
      viewId: "table",
    });
  });

  it("returns null viewId when the path's view segment is invalid", () => {
    expect(parsePath("/views/plans/plan-abc/nonsense")).toEqual({
      groupKind: "plan",
      groupId: "plan-abc",
      viewId: null,
    });
  });

  it("tolerates trailing slash", () => {
    expect(parsePath("/views/plans/plan-abc/")).toEqual({
      groupKind: "plan",
      groupId: "plan-abc",
      viewId: null,
    });
  });

  it("returns nulls for any /views URL with an unknown kind segment", () => {
    expect(parsePath("/views/garbage/foo")).toEqual({
      groupKind: null,
      groupId: null,
      viewId: null,
    });
  });

  it("returns nulls for URLs outside /views", () => {
    expect(parsePath("/something/else")).toEqual({
      groupKind: null,
      groupId: null,
      viewId: null,
    });
  });
});

describe("buildGroupPath (pure)", () => {
  const { buildGroupPath } = __test;

  it("builds plan path without view", () => {
    expect(buildGroupPath("plan", "abc")).toBe("/views/plans/abc");
  });

  it("builds plan path with view", () => {
    expect(buildGroupPath("plan", "abc", "table")).toBe(
      "/views/plans/abc/table",
    );
  });

  it("builds list path with view", () => {
    expect(buildGroupPath("list", "xyz", "kanban")).toBe(
      "/views/lists/xyz/kanban",
    );
  });

  it("URI-encodes ids containing reserved chars", () => {
    expect(buildGroupPath("list", "a/b c", "map")).toBe(
      "/views/lists/a%2Fb%20c/map",
    );
  });
});

describe("useViewsRouter (hook)", () => {
  it("portfolio: /views with no params", () => {
    mockState.pathname = "/views";
    mockState.searchParams = new URLSearchParams("");
    const { result } = renderHook(() => useViewsRouter());
    expect(result.current.isPortfolio).toBe(true);
    expect(result.current.groupKind).toBe(null);
    expect(result.current.groupId).toBe(null);
    expect(result.current.viewId).toBe(null);
    expect(result.current.bucket).toBe("mine");
  });

  it("portfolio with team bucket: /views?bucket=team", () => {
    mockState.pathname = "/views";
    mockState.searchParams = new URLSearchParams("bucket=team");
    const { result } = renderHook(() => useViewsRouter());
    expect(result.current.isPortfolio).toBe(true);
    expect(result.current.bucket).toBe("team");
  });

  it("portfolio with archived bucket: /views?bucket=archived", () => {
    mockState.pathname = "/views";
    mockState.searchParams = new URLSearchParams("bucket=archived");
    const { result } = renderHook(() => useViewsRouter());
    expect(result.current.isPortfolio).toBe(true);
    expect(result.current.bucket).toBe("archived");
  });

  it("portfolio with unknown bucket falls back to mine", () => {
    mockState.pathname = "/views";
    mockState.searchParams = new URLSearchParams("bucket=garbage");
    const { result } = renderHook(() => useViewsRouter());
    expect(result.current.bucket).toBe("mine");
  });

  it("plan default view: /views/plans/plan-abc", () => {
    mockState.pathname = "/views/plans/plan-abc";
    const { result } = renderHook(() => useViewsRouter());
    expect(result.current.isPortfolio).toBe(false);
    expect(result.current.groupKind).toBe("plan");
    expect(result.current.groupId).toBe("plan-abc");
    expect(result.current.viewId).toBe(null);
  });

  it("plan specific view: /views/plans/plan-abc/table", () => {
    mockState.pathname = "/views/plans/plan-abc/table";
    const { result } = renderHook(() => useViewsRouter());
    expect(result.current.groupKind).toBe("plan");
    expect(result.current.groupId).toBe("plan-abc");
    expect(result.current.viewId).toBe("table");
  });

  it("list default view: /views/lists/list-xyz", () => {
    mockState.pathname = "/views/lists/list-xyz";
    const { result } = renderHook(() => useViewsRouter());
    expect(result.current.groupKind).toBe("list");
    expect(result.current.groupId).toBe("list-xyz");
  });

  it("list specific view: /views/lists/list-xyz/contacts", () => {
    mockState.pathname = "/views/lists/list-xyz/contacts";
    const { result } = renderHook(() => useViewsRouter());
    expect(result.current.groupKind).toBe("list");
    expect(result.current.viewId).toBe("contacts");
  });

  it("goToGroup pushes the right path", () => {
    mockState.pathname = "/views";
    const { result } = renderHook(() => useViewsRouter());
    act(() => result.current.goToGroup("plan", "plan-abc", "table"));
    expect(mockState.push).toHaveBeenCalledWith("/views/plans/plan-abc/table");
  });

  it("goToPortfolio with no bucket lands on the default tab", () => {
    const { result } = renderHook(() => useViewsRouter());
    act(() => result.current.goToPortfolio());
    expect(mockState.push).toHaveBeenCalledWith("/views");
  });

  it("goToPortfolio('mine') produces the canonical bare URL", () => {
    const { result } = renderHook(() => useViewsRouter());
    act(() => result.current.goToPortfolio("mine"));
    expect(mockState.push).toHaveBeenCalledWith("/views");
  });

  it("goToPortfolio('team') sets ?bucket=team", () => {
    const { result } = renderHook(() => useViewsRouter());
    act(() => result.current.goToPortfolio("team"));
    expect(mockState.push).toHaveBeenCalledWith("/views?bucket=team");
  });

  it("goToPortfolio('archived') sets ?bucket=archived", () => {
    const { result } = renderHook(() => useViewsRouter());
    act(() => result.current.goToPortfolio("archived"));
    expect(mockState.push).toHaveBeenCalledWith("/views?bucket=archived");
  });
});
