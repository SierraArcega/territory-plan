"use client";

/**
 * Phase B placeholder for the GroupCanvas (header + view tabs + body).
 *
 * Phase C implements the real header + tabs strip + 8 view bodies. Until
 * then this stub renders just enough to confirm the dynamic route segment
 * is wired: it echoes the plan/list id + viewId from the URL so the smoke
 * test can verify deep-linking works.
 */
import type { GroupKind } from "../../hooks/useViewsRouter";
import { lookupViewSpec, type ViewId } from "../../lib/view-types";

interface GroupCanvasStubProps {
  kind: GroupKind;
  groupId: string;
  viewId: ViewId;
}

export default function GroupCanvasStub({
  kind,
  groupId,
  viewId,
}: GroupCanvasStubProps) {
  const view = lookupViewSpec(viewId);
  const ViewIcon = view.icon;
  const kindLabel = kind === "plan" ? "Plan" : "List";

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-[#FFFCFA] overflow-hidden">
      <header className="border-b border-[#D4CFE2] bg-white px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
          {kindLabel}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#403770] tracking-tight whitespace-nowrap">
            {kindLabel} {groupId}
          </h1>
          <span className="text-[#A69DC0] whitespace-nowrap">/</span>
          <span className="inline-flex items-center gap-1.5 text-[#F37167]">
            <ViewIcon className="w-4 h-4" aria-hidden />
          </span>
          <span className="text-base font-semibold text-[#544A78] whitespace-nowrap">
            {view.label}
          </span>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="rounded-lg border border-[#D4CFE2] bg-white p-6 text-sm text-[#6E6390]">
          <p className="whitespace-nowrap">
            GroupCanvas placeholder — Phase C builds the real view body.
          </p>
          <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[#544A78]">
            <dt className="text-[#8A80A8] whitespace-nowrap">Kind:</dt>
            <dd className="whitespace-nowrap">{kind}</dd>
            <dt className="text-[#8A80A8] whitespace-nowrap">Group ID:</dt>
            <dd className="whitespace-nowrap break-all">{groupId}</dd>
            <dt className="text-[#8A80A8] whitespace-nowrap">View:</dt>
            <dd className="whitespace-nowrap">{viewId}</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
