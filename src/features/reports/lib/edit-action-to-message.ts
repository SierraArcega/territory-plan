import type { ChipEditAction } from "./agent/types";

export function editActionToMessage(action: ChipEditAction): string {
  switch (action.type) {
    case "remove_filter":
      return `Remove the filter "${action.label}".`;
    case "change_filter":
      return `Change the "${action.label}" filter from ${action.from} to ${action.to}.`;
    case "remove_column":
      return `Remove the "${action.label}" column from the output.`;
    case "add_column":
      return `Add a "${action.label}" column to the output.`;
    case "change_sort":
      return `Sort by "${action.column}" ${action.direction === "desc" ? "descending" : "ascending"}.`;
    case "remove_sort":
      return `Remove the sort.`;
    case "change_limit":
      return `Change the row limit from ${action.from} to ${action.to}.`;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
