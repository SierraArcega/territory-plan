"use client";

/**
 * Lists subsection of the My Views sidebar.
 *
 * Header: list-checks icon + "Lists" + a `+` button that opens the builder.
 * Body: real `GroupRow` entries for every visible saved list.
 *
 * Mirrors `PlansSubsection`'s loading/error/empty states. The `+` button
 * dispatches `openBuilder()` on the views store — the actual modal ships in
 * Phase E. Wiring it now lets a tester confirm the action fires without
 * needing the modal to exist yet.
 */
import { ListChecks, Plus } from "lucide-react";
import {
  useLists,
  type SavedListSummary,
} from "../lib/queries";
import { useViewsStore, selectShowHidden } from "../lib/store";
import GroupRow from "./GroupRow";

export default function ListsSubsection() {
  const showHidden = useViewsStore(selectShowHidden);
  const openBuilder = useViewsStore((s) => s.openBuilder);
  const listsQ = useLists(showHidden);

  const visibleLists = (listsQ.data ?? []).filter((l) =>
    showHidden ? true : !l.hidden,
  );

  return (
    <section className="mt-3">
      <header className="flex items-center justify-between px-2 mb-1">
        <div className="flex items-center gap-1.5">
          <ListChecks
            className="w-3.5 h-3.5 text-[#544A78]"
            aria-hidden
            strokeWidth={2}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#403770] whitespace-nowrap">
            Lists
          </span>
        </div>
        <button
          type="button"
          onClick={() => openBuilder()}
          className="text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 p-0.5 rounded-sm"
          aria-label="New list"
          title="New list"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden />
        </button>
      </header>

      <Body
        isLoading={listsQ.isLoading}
        isError={listsQ.isError}
        lists={visibleLists}
      />
    </section>
  );
}

interface BodyProps {
  isLoading: boolean;
  isError: boolean;
  lists: SavedListSummary[];
}

/** Count flat rules in a filter tree — used as a tiny badge on list rows. */
function countRules(tree: SavedListSummary["filterTree"]): number {
  if (!tree) return 0;
  if (tree.kind === "and") {
    return tree.children.reduce((acc, c) => {
      if (c.kind === "and") return acc + countRules(c);
      // rule or any → counts as one chip in the badge
      return acc + 1;
    }, 0);
  }
  return 1;
}

function Body({ isLoading, isError, lists }: BodyProps) {
  if (isLoading) {
    return (
      <ul aria-busy="true">
        {Array.from({ length: 2 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-2 px-2 py-1.5"
            aria-hidden
          >
            <span className="w-3 h-3 flex-shrink-0" />
            <span className="w-3 h-3 rounded-sm bg-[#EFEDF5] flex-shrink-0" />
            <span className="flex-1 min-w-0 h-3 rounded-md bg-[#F7F5FA] animate-pulse" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div className="px-2 py-1.5 text-[11px] text-[#8A80A8] whitespace-nowrap">
        Couldn&apos;t load lists
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="px-2 py-1.5 text-[11px] text-[#8A80A8] whitespace-nowrap">
        No lists yet
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {lists.map((l) => (
        <li key={l.id}>
          <GroupRow
            kind="list"
            id={l.id}
            label={l.name}
            filterCount={countRules(l.filterTree)}
          />
        </li>
      ))}
    </ul>
  );
}
