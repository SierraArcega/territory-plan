import { describe, it, expect } from "vitest";
import { editActionToMessage } from "../edit-action-to-message";

describe("editActionToMessage", () => {
  it("translates remove_filter", () => {
    const msg = editActionToMessage({
      type: "remove_filter",
      chipId: "f1",
      label: "State: Texas",
    });
    expect(msg.toLowerCase()).toContain("remove");
    expect(msg).toContain("State: Texas");
  });

  it("translates change_filter", () => {
    const msg = editActionToMessage({
      type: "change_filter",
      chipId: "f1",
      label: "Year",
      from: "FY25",
      to: "FY26",
    });
    expect(msg).toContain("FY25");
    expect(msg).toContain("FY26");
  });

  it("translates remove_column, add_column", () => {
    expect(
      editActionToMessage({ type: "remove_column", columnId: "c1", label: "Bookings" }),
    ).toContain("Bookings");
    expect(editActionToMessage({ type: "add_column", label: "Rep email" })).toContain(
      "Rep email",
    );
  });

  it("translates change_sort + remove_sort", () => {
    expect(
      editActionToMessage({ type: "change_sort", column: "Bookings", direction: "desc" }),
    ).toMatch(/sort|order/i);
    expect(editActionToMessage({ type: "remove_sort" })).toMatch(/sort/i);
  });

  it("translates change_limit", () => {
    const msg = editActionToMessage({ type: "change_limit", from: 100, to: 500 });
    expect(msg).toMatch(/100.*500|500/);
  });
});
