"use client";

/**
 * ListBuilderModal — primary creation surface for SavedLists.
 *
 * Mounts once at the /views layout level and opens when
 * `useViewsStore(s => s.builderOpen)` flips true. Closes via the X button,
 * Cancel, click on the backdrop, or Escape key (per CLAUDE.md).
 *
 * Layout (per prototype):
 *   ┌─ Header: 📋 NEW LIST / Build a saved list                 [X] ┐
 *   ├─────────────────────────── body (1fr / 280px) ──────────────┤
 *   │ AI prompt block                                  │           │
 *   │ ── or edit manually ──                            │  Live    │
 *   │ Source picker (6 cards)                           │  preview │
 *   │ Conditions (flat AND)                             │  pane    │
 *   │ Scope (when source !== districts)                 │          │
 *   │ Save as                                           │          │
 *   ├──────────────────────────────────────────────────┴──────────┤
 *   │ {N} conditions · {count} source       [Cancel] [Create list] │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * State management lives entirely in this component — the only persistent
 * bridge to the rest of the app is `useViewsStore(builderOpen/builderSeed)`
 * for open/close and `useCreateList()` for the final POST.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  emptyAndTree,
  flattenForUi,
  type FilterAnd,
  type FilterLeaf,
  type FilterNode,
  type ListSpec,
  type SavedListSource,
  type ScopeMode,
  type ScopeRefKind,
} from "@/lib/saved-views/filter-tree";
import { useViewsStore } from "../../lib/store";
import {
  useCreateList,
  useLists,
  useListPreview,
  usePlansWithStats,
} from "../../lib/queries";
import AiPromptBlock from "./AiPromptBlock";
import SourcePicker from "./SourcePicker";
import ConditionsEditor from "./ConditionsEditor";
import ScopeEditor from "./ScopeEditor";
import SaveAsBlock from "./SaveAsBlock";
import LivePreviewPane from "./LivePreviewPane";
import ModalFooter from "./ModalFooter";
import {
  SOURCE_DEFAULT_VIEW,
  defaultRule,
  defaultDistrictsRule,
  pruneRulesForSource,
  rulesToTree,
  totalLeafCount,
} from "./builder-utils";

/** Internal modal state — owned by this component, reset on close. */
interface BuilderState {
  source: SavedListSource;
  rules: FilterLeaf[];
  scopeMode: ScopeMode;
  scopeRules: FilterLeaf[];
  scopeRefKind: ScopeRefKind | null;
  scopeRefId: string | null;
  name: string;
  shared: boolean;
  notice: string | null;
}

function makeInitialState(source: SavedListSource = "districts"): BuilderState {
  return {
    source,
    rules: [defaultRule(source)],
    scopeMode: "none",
    scopeRules: [defaultDistrictsRule()],
    scopeRefKind: null,
    scopeRefId: null,
    name: "",
    shared: false,
    notice: null,
  };
}

export default function ListBuilderModal() {
  const open = useViewsStore((s) => s.builderOpen);
  const seed = useViewsStore((s) => s.builderSeed);
  const closeBuilder = useViewsStore((s) => s.closeBuilder);

  // Render nothing when closed — keeps mount cost zero on cold pages.
  if (!open) return null;
  return <ListBuilderModalBody seed={seed} onClose={closeBuilder} />;
}

interface ListBuilderModalBodyProps {
  seed: { filters?: ListSpec; name?: string } | null;
  onClose: () => void;
}

function ListBuilderModalBody({ seed, onClose }: ListBuilderModalBodyProps) {
  const router = useRouter();
  const createList = useCreateList();

  // Seed -> initial state on mount.
  const [state, setState] = useState<BuilderState>(() => {
    const initial = makeInitialState(seed?.filters?.source ?? "districts");
    if (seed?.filters) {
      const flat = flattenForUi(seed.filters.filterTree);
      initial.source = seed.filters.source;
      initial.rules = flat.rules.length
        ? flat.rules
        : [defaultRule(seed.filters.source)];
      if (seed.filters.scope.mode === "rules") {
        const scopeFlat = flattenForUi(seed.filters.scope.filterTree);
        initial.scopeMode = "rules";
        initial.scopeRules = scopeFlat.rules.length
          ? scopeFlat.rules
          : [defaultDistrictsRule()];
      } else if (seed.filters.scope.mode === "reference") {
        initial.scopeMode = "reference";
        initial.scopeRefKind = seed.filters.scope.kind;
        initial.scopeRefId = seed.filters.scope.id;
      } else {
        initial.scopeMode = "none";
      }
      if (flat.warnings.length > 0) {
        initial.notice =
          "Some advanced logic was simplified — review conditions";
      }
    }
    if (seed?.name) initial.name = seed.name;
    return initial;
  });

  // ── ESC + outside-click handlers ─────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ── State updaters ──────────────────────────────────────────────────────
  const setSource = (next: SavedListSource) => {
    setState((s) => {
      if (s.source === next) return s;
      // Drop incompatible rules; new source gets a fresh default rule if empty.
      const pruned = pruneRulesForSource(s.rules, next);
      return {
        ...s,
        source: next,
        rules: pruned.length > 0 ? pruned : [defaultRule(next)],
        scopeMode: next === "districts" ? "none" : s.scopeMode,
      };
    });
  };

  const setRules = (next: FilterLeaf[]) => setState((s) => ({ ...s, rules: next }));

  const setScopeMode = (mode: ScopeMode) =>
    setState((s) => ({ ...s, scopeMode: mode }));

  const setScopeRules = (next: FilterLeaf[]) =>
    setState((s) => ({ ...s, scopeRules: next }));

  const setScopeRef = (kind: ScopeRefKind, id: string) =>
    setState((s) => ({ ...s, scopeRefKind: kind, scopeRefId: id }));

  const setName = (next: string) => setState((s) => ({ ...s, name: next }));

  const setShared = (next: boolean) => setState((s) => ({ ...s, shared: next }));

  const setNotice = (next: string | null) =>
    setState((s) => ({ ...s, notice: next }));

  // ── AI success → populate fields ────────────────────────────────────────
  const onAiSuccess = useCallback(
    ({ listSpec, name }: { listSpec: ListSpec; name: string }) => {
      const flat = flattenForUi(listSpec.filterTree);
      let scopeMode: ScopeMode = "none";
      let scopeRules: FilterLeaf[] = [defaultDistrictsRule()];
      let scopeRefKind: ScopeRefKind | null = null;
      let scopeRefId: string | null = null;
      let warnings = flat.warnings;
      if (listSpec.scope.mode === "rules") {
        const scopeFlat = flattenForUi(listSpec.scope.filterTree);
        warnings = warnings.concat(scopeFlat.warnings);
        scopeMode = "rules";
        scopeRules = scopeFlat.rules.length
          ? scopeFlat.rules
          : [defaultDistrictsRule()];
      } else if (listSpec.scope.mode === "reference") {
        scopeMode = "reference";
        scopeRefKind = listSpec.scope.kind;
        scopeRefId = listSpec.scope.id;
      }
      setState((s) => ({
        ...s,
        source: listSpec.source,
        rules: flat.rules.length ? flat.rules : [defaultRule(listSpec.source)],
        scopeMode,
        scopeRules,
        scopeRefKind,
        scopeRefId,
        name: s.name && s.name.trim().length > 0 ? s.name : name,
        notice:
          warnings.length > 0
            ? "Some advanced logic was simplified — review conditions"
            : null,
      }));
    },
    [],
  );

  // ── Derived view models ────────────────────────────────────────────────
  const filterTree: FilterAnd = useMemo(() => rulesToTree(state.rules), [state.rules]);

  const scopeFilterTree: FilterNode | null = useMemo(
    () => (state.scopeMode === "rules" ? rulesToTree(state.scopeRules) : null),
    [state.scopeMode, state.scopeRules],
  );

  const previewSpec = useMemo(
    () => ({
      source: state.source,
      filterTree: filterTree as FilterNode,
      scopeMode: state.scopeMode,
      scopeFilterTree,
      scopeRefKind: state.scopeRefKind,
      scopeRefId: state.scopeRefId,
    }),
    [
      state.source,
      filterTree,
      state.scopeMode,
      scopeFilterTree,
      state.scopeRefKind,
      state.scopeRefId,
    ],
  );

  // Resolve the scope-reference display name from the loaded plans/lists.
  const plansQ = usePlansWithStats();
  const listsQ = useLists();
  const scopeRefName = useMemo(() => {
    if (state.scopeMode !== "reference" || !state.scopeRefId) return null;
    if (state.scopeRefKind === "plan") {
      return plansQ.data?.find((p) => p.id === state.scopeRefId)?.name ?? null;
    }
    return listsQ.data?.find((l) => l.id === state.scopeRefId)?.name ?? null;
  }, [
    state.scopeMode,
    state.scopeRefId,
    state.scopeRefKind,
    plansQ.data,
    listsQ.data,
  ]);

  const leafCount = totalLeafCount(state.rules, state.scopeMode, state.scopeRules);

  // ── Submit ──────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    // Trim and fall back to a sensible default if rep didn't name it.
    const finalName = state.name.trim() || `Untitled ${state.source} list`;
    try {
      const created = await createList.mutateAsync({
        name: finalName,
        source: state.source,
        filterTree: filterTree as FilterNode,
        scopeMode: state.scopeMode,
        scopeFilterTree:
          state.scopeMode === "rules" ? scopeFilterTree : null,
        scopeRefKind:
          state.scopeMode === "reference" ? state.scopeRefKind : null,
        scopeRefId:
          state.scopeMode === "reference" ? state.scopeRefId : null,
        shared: state.shared,
      });
      onClose();
      router.push(
        `/views/lists/${created.id}/${SOURCE_DEFAULT_VIEW[state.source]}`,
      );
    } catch (e) {
      // Surface the error inline via the notice slot — keep the modal open.
      setNotice(
        e instanceof Error ? `Couldn't save — ${e.message}` : "Couldn't save",
      );
    }
  };

  const submitDisabled =
    state.rules.length === 0 ||
    (state.scopeMode === "reference" && !state.scopeRefId);

  // Focus management — autofocus the AI input on mount.
  const aiInputRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = aiInputRef.current?.querySelector(
      "input[aria-label='AI prompt']",
    ) as HTMLInputElement | null;
    input?.focus();
  }, []);

  // Duplicate read of the preview query — TanStack dedups by key, so calling
  // useListPreview() twice with the same spec costs nothing. Lets us show the
  // count in the footer without piping it back from LivePreviewPane.
  const previewQ = useListPreview(previewSpec);
  const previewMatchCount = previewQ.data?.count ?? null;

  return (
    <>
      {/* Inline keyframes — modal-local so the global CSS file stays small. */}
      <style>{`
        @keyframes lbFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lbSlide {
          from { transform: translateY(8px); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Build a saved list"
        className="fixed inset-0 z-50 flex items-center justify-center p-8"
        style={{
          background: "rgba(64,55,112,0.45)",
          animation: "lbFade 150ms ease-out",
        }}
        onMouseDown={onBackdropClick}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-[880px] flex flex-col overflow-hidden"
          style={{
            maxHeight: "88vh",
            boxShadow: "0 24px 48px rgba(64,55,112,0.25)",
            animation: "lbSlide 200ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E2DEEC] flex items-center justify-between flex-shrink-0">
            <div>
              <div className="text-[10px] font-bold text-[#8A80A8] uppercase tracking-wider whitespace-nowrap">
                📋 New list
              </div>
              <h2 className="text-lg font-bold text-[#403770] tracking-tight mt-0.5">
                Build a saved list
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-[#8A80A8] hover:text-[#403770] hover:bg-[#F7F5FA] transition-colors duration-100"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>

          {/* Body — 1fr / 280px grid; left scrolls, right is sticky */}
          <div
            className="flex-1 overflow-auto grid min-h-0"
            style={{ gridTemplateColumns: "1fr 280px" }}
          >
            <div
              ref={aiInputRef}
              className="px-6 py-5 border-r border-[#E2DEEC] flex flex-col gap-5 min-w-0"
            >
              <AiPromptBlock
                onSuccess={onAiSuccess}
                externalNotice={state.notice}
              />

              <ManualDivider />

              <Section
                title="Source"
                hint="What kind of records belong in this list?"
              >
                <SourcePicker value={state.source} onChange={setSource} />
              </Section>

              <Section
                title="Conditions"
                hint="Records must match all of these."
              >
                <ConditionsEditor
                  rules={state.rules}
                  source={state.source}
                  onChange={setRules}
                />
              </Section>

              {state.source !== "districts" && (
                <Section
                  title="Scope"
                  hint="Limit to records attached to specific districts."
                >
                  <ScopeEditor
                    mode={state.scopeMode}
                    scopeRules={state.scopeRules}
                    refKind={state.scopeRefKind}
                    refId={state.scopeRefId}
                    onModeChange={setScopeMode}
                    onRulesChange={setScopeRules}
                    onRefChange={setScopeRef}
                  />
                </Section>
              )}

              <Section title="Save as">
                <SaveAsBlock
                  source={state.source}
                  name={state.name}
                  shared={state.shared}
                  onNameChange={setName}
                  onSharedChange={setShared}
                />
              </Section>
            </div>

            <LivePreviewPane
              spec={previewSpec}
              source={state.source}
              scopeMode={state.scopeMode}
              scopeRefName={scopeRefName}
            />
          </div>

          <ModalFooter
            leafCount={leafCount}
            matchCount={previewMatchCount}
            source={state.source}
            submitDisabled={submitDisabled}
            submitting={createList.isPending}
            onCancel={onClose}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </>
  );
}

// ── Small subcomponents ──────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-2">
        <div className="text-[13px] font-bold text-[#403770]">{title}</div>
        {hint && <div className="text-[11px] text-[#8A80A8] mt-0.5">{hint}</div>}
      </div>
      {children}
    </section>
  );
}

function ManualDivider() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <div className="flex-1 h-px bg-[#E2DEEC]" />
      <span className="text-[10px] text-[#A69DC0] font-semibold uppercase tracking-wider whitespace-nowrap">
        Or edit manually
      </span>
      <div className="flex-1 h-px bg-[#E2DEEC]" />
    </div>
  );
}
