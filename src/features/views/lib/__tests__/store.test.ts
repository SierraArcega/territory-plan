import { describe, it, expect, beforeEach } from "vitest";
import { useViewsStore } from "../store";
import type { ListSpec } from "@/lib/saved-views/filter-tree";

describe("useViewsStore", () => {
  beforeEach(() => {
    // Reset store between tests — persistence layer keeps density across tests
    // unless we explicitly reset it.
    useViewsStore.setState({
      expandedGroups: {},
      hoverId: null,
      menuGroupId: null,
      showHidden: false,
      density: "compact",
      builderOpen: false,
      builderSeed: null,
    });
  });

  describe("toggleGroup", () => {
    it("expands a previously-collapsed group", () => {
      useViewsStore.getState().toggleGroup("plan:abc");
      expect(useViewsStore.getState().expandedGroups["plan:abc"]).toBe(true);
    });

    it("collapses an expanded group on second toggle", () => {
      useViewsStore.getState().toggleGroup("plan:abc");
      useViewsStore.getState().toggleGroup("plan:abc");
      expect(useViewsStore.getState().expandedGroups["plan:abc"]).toBe(false);
    });

    it("does not affect other groups", () => {
      useViewsStore.getState().toggleGroup("plan:abc");
      useViewsStore.getState().toggleGroup("list:xyz");
      expect(useViewsStore.getState().expandedGroups["plan:abc"]).toBe(true);
      expect(useViewsStore.getState().expandedGroups["list:xyz"]).toBe(true);
    });
  });

  describe("setGroupExpanded", () => {
    it("sets a group's expanded flag directly", () => {
      useViewsStore.getState().setGroupExpanded("plan:abc", true);
      expect(useViewsStore.getState().expandedGroups["plan:abc"]).toBe(true);

      useViewsStore.getState().setGroupExpanded("plan:abc", false);
      expect(useViewsStore.getState().expandedGroups["plan:abc"]).toBe(false);
    });
  });

  describe("collapseAll", () => {
    it("clears all expanded groups", () => {
      useViewsStore.getState().toggleGroup("plan:abc");
      useViewsStore.getState().toggleGroup("list:xyz");
      useViewsStore.getState().collapseAll();
      expect(Object.keys(useViewsStore.getState().expandedGroups)).toHaveLength(0);
    });
  });

  describe("hover + menu", () => {
    it("sets and clears hover id", () => {
      useViewsStore.getState().setHoverId("plan:abc");
      expect(useViewsStore.getState().hoverId).toBe("plan:abc");
      useViewsStore.getState().setHoverId(null);
      expect(useViewsStore.getState().hoverId).toBe(null);
    });

    it("tracks the currently-open context menu", () => {
      useViewsStore.getState().setMenuGroupId("list:abc");
      expect(useViewsStore.getState().menuGroupId).toBe("list:abc");
    });
  });

  describe("showHidden", () => {
    it("toggles", () => {
      expect(useViewsStore.getState().showHidden).toBe(false);
      useViewsStore.getState().toggleShowHidden();
      expect(useViewsStore.getState().showHidden).toBe(true);
      useViewsStore.getState().toggleShowHidden();
      expect(useViewsStore.getState().showHidden).toBe(false);
    });

    it("sets directly", () => {
      useViewsStore.getState().setShowHidden(true);
      expect(useViewsStore.getState().showHidden).toBe(true);
    });
  });

  describe("density", () => {
    it("toggles between compact and comfortable", () => {
      useViewsStore.getState().setDensity("compact");
      useViewsStore.getState().toggleDensity();
      expect(useViewsStore.getState().density).toBe("comfortable");
      useViewsStore.getState().toggleDensity();
      expect(useViewsStore.getState().density).toBe("compact");
    });
  });

  describe("builder", () => {
    it("opens with no seed by default", () => {
      useViewsStore.getState().openBuilder();
      const s = useViewsStore.getState();
      expect(s.builderOpen).toBe(true);
      expect(s.builderSeed).toBe(null);
    });

    it("opens with a seed payload", () => {
      const seed = {
        name: "High-priority prospects",
        filters: {
          schemaVersion: 1 as const,
          source: "districts",
          filterTree: { kind: "and", children: [] },
          scope: { mode: "none" },
        } satisfies ListSpec,
      };
      useViewsStore.getState().openBuilder(seed);
      const s = useViewsStore.getState();
      expect(s.builderOpen).toBe(true);
      expect(s.builderSeed).toEqual(seed);
    });

    it("close clears both open flag and seed", () => {
      useViewsStore.getState().openBuilder({ name: "test" });
      useViewsStore.getState().closeBuilder();
      const s = useViewsStore.getState();
      expect(s.builderOpen).toBe(false);
      expect(s.builderSeed).toBe(null);
    });
  });
});
